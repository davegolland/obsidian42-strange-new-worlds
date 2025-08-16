import { MarkdownView, Platform, View, type WorkspaceLeaf } from "obsidian";
import { htmlDecorationForReferencesElement } from "src/view-extensions/htmlDecorations";
import type SNWPlugin from "../main";
import type { TransformedCachedItem } from "../types";
import { ReferenceCountingPolicy } from "../policies/reference-counting";

let plugin: SNWPlugin;
let referenceCountingPolicy: ReferenceCountingPolicy;

export function setPluginVariableForFrontmatterLinksRefCount(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
	referenceCountingPolicy = plugin.referenceCountingPolicy;
}

// Export the direct function instead of a debounced wrapper
export function updateProperties() {
	setFrontmatterLinksReferenceCounts();
}

function setFrontmatterLinksReferenceCounts() {
	plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
		if (leaf.view.getViewType() === "markdown" || leaf.view.getViewType() === "file-properties") processFrontmatterLinks(leaf.view);
	});
}

function processFrontmatterLinks(mdView: View) {
	if (!plugin.showCountsActive) return;
	const state =
		Platform.isMobile || Platform.isMobileApp ? plugin.settings.display.propertyReferencesMobile : plugin.settings.display.propertyReferences;

	const markdownView = mdView as MarkdownView;
	if (!state || !markdownView?.rawFrontmatter) return;

	// For now, use a synchronous approach - this will be updated in a future version
	// to properly handle virtual links
	const transformedCache = markdownView.file ? referenceCountingPolicy.getSNWCacheByFile(markdownView.file) as any : {};
	if (!transformedCache.frontmatterLinks?.length) return;

	for (const item of markdownView.metadataEditor.rendered) {
		const innerLink = item.valueEl.querySelector(".metadata-link-inner.internal-link") as HTMLElement;
		if (innerLink) {
			const innerLinkText = innerLink.textContent;
			const fmMatch = transformedCache.frontmatterLinks?.find((item) => item.displayText === innerLinkText);
			if (fmMatch) appendRefCounter(innerLink as HTMLElement, fmMatch);
		}

		const pillLinks = item.valueEl.querySelectorAll(".multi-select-pill.internal-link .multi-select-pill-content span");
		if (!pillLinks.length) continue;
		for (const pill of Array.from(pillLinks) as HTMLElement[]) {
			const pillText = pill.textContent;
			const fmMatch = transformedCache.frontmatterLinks?.find((item) => item.displayText === pillText);
			const parent = pill.parentElement;
			if (fmMatch && parent) appendRefCounter(parent, fmMatch);
		}
	}
}

function appendRefCounter(parentLink: HTMLElement, cacheItem: TransformedCachedItem) {
	let wrapperEl = parentLink.parentElement?.querySelector(".snw-frontmatter-wrapper");
	const refCount = referenceCountingPolicy.countReferences(cacheItem.references);

	if (!wrapperEl && refCount >= plugin.settings.minimumRefCountThreshold) {
		wrapperEl = createSpan({ cls: "snw-frontmatter-wrapper" });
		const htmlCounter = htmlDecorationForReferencesElement(
			refCount,
			"link",
			cacheItem.references[0].realLink,
			cacheItem.key,
			cacheItem.references[0]?.resolvedFile?.path ?? "",
			"snw-frontmatter-count",
			cacheItem.pos.start.line,
		);
		wrapperEl.appendChild(htmlCounter);
		parentLink.insertAdjacentElement("afterend", wrapperEl);
	} else {
		try {
			//update the existing wrapper with current count, otherwise if the count fell below the threshold, remove it
			if (refCount >= plugin.settings.minimumRefCountThreshold) {
				const countElement = wrapperEl?.querySelector(".snw-frontmatter-count") as HTMLElement | null;
				if (countElement) {
					countElement.innerText = ` ${refCount} `;
				}
			} else {
				wrapperEl?.remove();
			}
		} catch (error) {}
	}
}
