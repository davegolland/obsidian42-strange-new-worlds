// Displays in the header of open documents the count of incoming links

import { type MarkdownView, Platform, type TFile, type WorkspaceLeaf } from "obsidian";
import tippy from "tippy.js";
import type SNWPlugin from "../main";
import { processHtmlDecorationReferenceEvent } from "../view-extensions/htmlDecorations";
import "tippy.js/dist/tippy.css";
import { getUIC_Hoverview } from "./components/uic-ref--parent";
import { type Link } from "../types";

let plugin: SNWPlugin;

export function setPluginVariableForHeaderRefCount(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
}

// Export the direct function instead of a debounced wrapper
export function updateHeaders() {
	setHeaderWithReferenceCounts();
}

// Iterates all open documents to see if they are markdown file, and if so called processHeader
function setHeaderWithReferenceCounts() {
	if (!plugin.settings.display.incomingFilesHeader || !plugin.showCountsActive) return;
	plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
		if (leaf.view.getViewType() === "markdown") processHeader(leaf.view as MarkdownView);
	});
}

// Count the incoming links for a file
function countIncomingLinks(mdViewFile: TFile) {
	const allLinks = plugin.referenceCountingPolicy.getIndexedReferences();
	let incomingLinksCount = 0;
	
	// Calculate the incoming links count
	for (const items of allLinks.values()) {
		for (const item of items) {
			if (item?.resolvedFile && item?.resolvedFile?.path === mdViewFile.path) {
				incomingLinksCount++;
			}
		}
	}

	// check if the page is to be ignored
	// For now, use a synchronous approach - this will be updated in a future version
	// to properly handle virtual links
	const transformedCache = plugin.referenceCountingPolicy.getSNWCacheByFile(mdViewFile) as any;
	if (transformedCache?.cacheMetaData?.frontmatter?.["snw-file-exclude"] === true) incomingLinksCount = 0;
	
	return incomingLinksCount;
}

// Creates or updates the header element in the view
function createHeaderElement(mdView: MarkdownView, mdViewFile: TFile, incomingLinksCount: number) {
	let snwTitleRefCountDisplayCountEl: HTMLElement | null = mdView.contentEl.querySelector(".snw-header-count");
	
	// header count is already displayed, just update information.
	if (snwTitleRefCountDisplayCountEl && snwTitleRefCountDisplayCountEl.dataset.snwKey === mdViewFile.basename) {
		snwTitleRefCountDisplayCountEl.innerText = ` ${incomingLinksCount.toString()} `;
		return { wrapper: null, snwTitleRefCountDisplayCountEl, isExisting: true };
	}

	// add new header count
	const containerViewContent: HTMLElement = mdView.contentEl;
	let wrapper: HTMLElement | null = containerViewContent.querySelector(".snw-header-count-wrapper");

	if (!wrapper) {
		wrapper = createDiv({ cls: "snw-reference snw-header-count-wrapper" });
		snwTitleRefCountDisplayCountEl = createDiv({ cls: "snw-header-count" });
		wrapper.appendChild(snwTitleRefCountDisplayCountEl);
		containerViewContent.prepend(wrapper);
	} else {
		snwTitleRefCountDisplayCountEl = containerViewContent.querySelector(".snw-header-count");
	}

	if (snwTitleRefCountDisplayCountEl) snwTitleRefCountDisplayCountEl.innerText = ` ${incomingLinksCount.toString()} `;
	
	wrapper.setAttribute("data-snw-reallink", mdViewFile.basename);
	wrapper.setAttribute("data-snw-key", mdViewFile.basename);
	wrapper.setAttribute("data-snw-type", "File");
	wrapper.setAttribute("data-snw-filepath", mdViewFile.path);

	return { wrapper, snwTitleRefCountDisplayCountEl, isExisting: false };
}

// Attaches event handlers and tippy to the header element
function attachTippy(wrapper: HTMLElement, snwTitleRefCountDisplayCountEl: HTMLElement | null) {
	if ((Platform.isDesktop || Platform.isDesktopApp) && snwTitleRefCountDisplayCountEl) {
		snwTitleRefCountDisplayCountEl.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			if (wrapper) processHtmlDecorationReferenceEvent(wrapper);
		};
	}

	wrapper.onclick = (e: MouseEvent) => {
		e.stopPropagation();
		processHtmlDecorationReferenceEvent(e.target as HTMLElement);
	};

	// defaults to showing tippy on hover, but if plugin.settings.requireModifierKeyToActivateSNWView is true, then only show on ctrl/meta key
	let showTippy = true;
	const tippyObject = tippy(wrapper, {
		interactive: true,
		appendTo: () => document.body,
		allowHTML: true,
		zIndex: 9999,
		placement: "auto-end",
		onTrigger(instance, event) {
			const mouseEvent = event as MouseEvent;
			if (plugin.settings.requireModifierKeyToActivateSNWView === false) return;
			if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
				showTippy = true;
			} else {
				showTippy = false;
			}
		},
		onShow(instance) {
			// returning false will cancel the show (coming from onTrigger)
			if (!showTippy) return false;

			setTimeout(async () => {
				await getUIC_Hoverview(instance);
			}, 1);
		},
	});

	tippyObject.popper.classList.add("snw-tippy");
}

// Analyzes the page and if there is incoming links displays a header message
function processHeader(mdView: MarkdownView) {
	const mdViewFile = mdView.file;
	if (!mdViewFile) return;
	
	// Count incoming links
	const incomingLinksCount = countIncomingLinks(mdViewFile);

	// if no incoming links, check if there is a header and remove it
	if (incomingLinksCount < 1) {
		const headerCountWrapper = mdView.contentEl.querySelector(".snw-header-count-wrapper");
		if (headerCountWrapper) headerCountWrapper.remove();
		return;
	}

	// Create or update the header element
	const { wrapper, snwTitleRefCountDisplayCountEl, isExisting } = createHeaderElement(mdView, mdViewFile, incomingLinksCount);
	
	// If we're just updating an existing element, we're done
	if (isExisting) return;
	
	// Attach event handlers and tippy
	if (wrapper) {
		attachTippy(wrapper, snwTitleRefCountDisplayCountEl);
	}
}
