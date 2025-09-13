import { Keymap, MarkdownView, Notice } from "obsidian";
import type SNWPlugin from "src/main";
import { scrollResultsIntoView } from "src/utils";
import type { Instance, ReferenceElement } from "tippy.js";
import { getUIC_Ref_Area } from "./uic-ref-area";
import { setPluginVariableUIC_RefItem } from "./uic-ref-item";

let plugin: SNWPlugin;

function getAttr(el: HTMLElement, name: string): string {
	return el.getAttribute(name) ?? "";
}

function getRealLink(el: HTMLElement): string {
	return getAttr(el, "data-snw-reallink") || getAttr(el, "data-snw-realLink");
}

export function setPluginVariableForUIC(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
	setPluginVariableUIC_RefItem(plugin);
}


/**
 * Pure builder function that returns an HTMLElement for hover content
 * Used by the new non-mutating approach
 */
export const getUIC_HoverviewElement = async (ctx: { referenceEl: HTMLElement, plugin: SNWPlugin }): Promise<HTMLElement> => {
	const { referenceEl, plugin } = ctx;
	
	// Read data attributes from referenceEl
	const refType = referenceEl.getAttribute("data-snw-type") || "";
	const realLink = getRealLink(referenceEl);
	const key = referenceEl.getAttribute("data-snw-key") || "";
	const filePath = referenceEl.getAttribute("data-snw-filepath") || "";
	const lineNu = Number(referenceEl.getAttribute("snw-data-line-number")) || 0;
	const display = referenceEl.getAttribute("data-snw-display") || undefined;
	
	// Build the popover DOM
	const popoverEl = createDiv();
	popoverEl.addClass("snw-popover-container");
	popoverEl.addClass("search-result-container");
	popoverEl.appendChild(await getUIC_Ref_Area(refType, realLink, key, filePath, lineNu, true, display));
	
	// Set up event handlers
	requestAnimationFrame(() => { void setFileLinkHandlers(false, popoverEl); });
	scrollResultsIntoView(popoverEl);
	
	return popoverEl;
};

// Loads the references into the side pane, using the same logic as the HoverView
export const getUIC_SidePane = async (
	refType: string,
	realLink: string,
	key: string,
	filePath: string,
	lineNu: number,
): Promise<HTMLElement> => {
	const sidepaneEL = createDiv();
	sidepaneEL.addClass("snw-sidepane-container");
	sidepaneEL.addClass("search-result-container");
	sidepaneEL.append(await getUIC_Ref_Area(refType, realLink, key, filePath, lineNu, false));

	requestAnimationFrame(() => { void setFileLinkHandlers(false, sidepaneEL); });

	return sidepaneEL;
};

// Creates event handlers for components of the HoverView and sidepane
export const setFileLinkHandlers = async (isHoverView: boolean, rootElementForViewEl: HTMLElement) => {
	const linksToFiles: NodeList = rootElementForViewEl.querySelectorAll(
		".snw-ref-item-file, .snw-ref-item-info, .snw-ref-title-popover-label",
	);
	// biome-ignore lint/complexity/noForEach: <explanation>
	linksToFiles.forEach((node: Element) => {
		if (!node.getAttribute("snw-has-handler")) {
			node.setAttribute("snw-has-handler", "true"); //prevent the event from being added twice
			// CLICK event
			node.addEventListener("click", async (e: MouseEvent) => {
				e.preventDefault();
				const handlerElement = (e.target as HTMLElement).closest(".snw-ref-item-file, .snw-ref-item-info, .snw-ref-title-popover-label");
				if (!handlerElement) return;
				let lineNu = Number(handlerElement.getAttribute("snw-data-line-number"));
				const filePath = handlerElement.getAttribute("snw-data-file-name");
				const fileT = app.metadataCache.getFirstLinkpathDest(filePath, filePath);

				if (!fileT) {
					new Notice(`File not found: ${filePath}. It may be a broken link.`);
					return;
				}

				plugin.app.workspace.getLeaf(Keymap.isModEvent(e)).openFile(fileT);

				// for file titles, the embed handling for titles related to block id's and headers is hard to calculate, so its more efficient to do it here
				const titleKey = handlerElement.getAttribute("snw-ref-title-key");
				if (titleKey) {
					if (titleKey.contains("#^")) {
						// links to a block id
						const destinationBlocks = Object.entries(plugin.app.metadataCache.getFileCache(fileT)?.blocks);
						if (destinationBlocks) {
							// @ts-ignore
							const blockID = titleKey
								.match(/#\^(.+)$/g)[0]
								.replace("#^", "")
								.toLowerCase();
							const l = destinationBlocks.find((b) => b[0] === blockID);
							lineNu = l[1].position.start.line;
						}
					} else if (titleKey.contains("#")) {
						// possibly links to a header
						const destinationHeadings = plugin.app.metadataCache.getFileCache(fileT)?.headings;
						if (destinationHeadings) {
							// @ts-ignore
							const headingKey = titleKey.match(/#(.+)/g)[0].replace("#", "");
							const l = destinationHeadings.find((h) => h.heading.toLocaleUpperCase() === headingKey);
							// @ts-ignore
							lineNu = l.position.start.line;
						}
					}
				}

				if (lineNu > 0) {
					setTimeout(() => {
						// jumps to the line of the file where the reference is located
						try {
							const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
							if (activeView) activeView.setEphemeralState({ line: lineNu });
						} catch (error) {}
					}, 400);
				}
			});
			// mouseover event
			if (plugin.app.internalPlugins.plugins["page-preview"].enabled === true) {
				// @ts-ignore
				node.addEventListener("mouseover", (e: PointerEvent) => {
					e.preventDefault();
					const hoverMetaKeyRequired =
						// @ts-ignore
						app.internalPlugins.plugins["page-preview"].instance.overrides["obsidian42-strange-new-worlds"] !== false;
					if (hoverMetaKeyRequired === false || (hoverMetaKeyRequired === true && Keymap.isModifier(e, "Mod"))) {
						const target = e.target as HTMLElement;
						const previewLocation = {
							scroll: Number(target.getAttribute("snw-data-line-number")),
						};
						const filePath = target.getAttribute("snw-data-file-name");
						if (filePath) {
							// parameter signature for link-hover parent: HoverParent, targetEl: HTMLElement, linkText: string, sourcePath: string, eState: EphemeralState
							app.workspace.trigger("link-hover", {}, target, filePath, "", previewLocation);
						}
					}
				});
			}
		}
	});
};

