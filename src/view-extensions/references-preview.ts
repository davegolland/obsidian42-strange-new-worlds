import {
	type MarkdownPostProcessorContext,
	MarkdownRenderChild,
	type MarkdownSectionInformation,
	type TFile,
	parseLinktext,
} from "obsidian";
import tippy from "tippy.js";
import type SNWPlugin from "../main";
import type { ReferenceCountingPolicy } from "../policies/reference-counting";
import type { Link } from "../types";
import { getUIC_Hoverview } from "../ui/components/uic-ref--parent";
import { htmlDecorationForReferencesElement } from "./htmlDecorations";

let plugin: SNWPlugin;
let referenceCountingPolicy: ReferenceCountingPolicy;

export function setPluginVariableForMarkdownPreviewProcessor(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
	referenceCountingPolicy = plugin.referenceCountingPolicy;
}

/**
 * Function called by main.registerMarkdownPostProcessor - this function renders the html when in preview mode
 * This function receives a section of the document for processsing. So this function is called many times for a document.
 */
export default function markdownPreviewProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
	// @ts-ignore
	if (ctx.remainingNestLevel === 4) return; // This is an attempt to prevent processing of embed files

	if (el.hasAttribute("uic")) return; // this is a custom component, don't render SNW inside it.

	// The following line addresses a conflict with the popular Tasks plugin.
	if (el.querySelectorAll(".contains-task-list").length > 0) return;

	const currentFile = plugin.app.vault.fileMap[ctx.sourcePath];
	if (currentFile === undefined) {
		//this is run if the processor is not run within a markdown file, rather a card on a canvas
		ctx.addChild(new snwChildComponentMardkownWithoutFile(el));
	} else {
		//this is run if the processor is run within a markdown file
		if (false) {
			const fileCache = plugin.app.metadataCache.getFileCache(currentFile);
			if (fileCache?.frontmatter?.["kanban-plugin"]) return;
		}
		ctx.addChild(new snwChildComponentForMarkdownFile(el, ctx.getSectionInfo(el), currentFile));
	}
}

// Processes pure markdown not coming from a document, like a card on a canvas that is not based on a file
class snwChildComponentMardkownWithoutFile extends MarkdownRenderChild {
	containerEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		super(containerEl);
		this.containerEl = containerEl;
	}

	onload(): void {
		for (const link of Array.from(this.containerEl.querySelectorAll("a.internal-link, span.internal-embed"))) {
			const ref = ((link as HTMLElement).dataset.href || link.getAttribute("src")) as string;
			const resolvedTFile = plugin.app.metadataCache.getFirstLinkpathDest(parseLinktext(ref).path, "/");
			if (!resolvedTFile) continue;

			const references = referenceCountingPolicy.findAllReferencesForLink("/", ref);
			const refCount = references.length;

			if (refCount <= 0 || refCount < 1) continue;

			const refType = link.classList.contains("internal-link") ? "link" : "embed";
			const key = referenceCountingPolicy.generateKeyFromPathAndLink("/", ref);

			const referenceElement = htmlDecorationForReferencesElement(
				refCount,
				refType,
				ref,
				key,
				resolvedTFile.path,
				`snw-liveupdate snw-${refType}-preview`,
				1,
			);
			link.after(referenceElement);
			// Mark so we don't add another badge if this block gets re-rendered
			(link as HTMLElement).setAttribute("data-snw-has-badge", "1");
		}
	}
}

// Processes markdown coming from a markdown file
class snwChildComponentForMarkdownFile extends MarkdownRenderChild {
	containerEl: HTMLElement;
	sectionInfo: MarkdownSectionInformation | null;
	currentFile: TFile;

	constructor(containerEl: HTMLElement, sectionInfo: MarkdownSectionInformation | null, currentFile: TFile) {
		super(containerEl);
		this.containerEl = containerEl;
		this.sectionInfo = sectionInfo;
		this.currentFile = currentFile;
	}

	onload(): void {
		const minRefCountThreshold = 1;
		// For now, use a synchronous approach - this will be updated in a future version
		// to properly handle virtual links
		const transformedCache = referenceCountingPolicy.getSNWCacheByFile(this.currentFile) as any;

		if (transformedCache?.cacheMetaData?.frontmatter?.["snw-file-exclude"] === true) return;
		if (transformedCache?.cacheMetaData?.frontmatter?.["snw-canvas-exclude-preview"] === true) return;

		if (transformedCache?.blocks || transformedCache.embeds || transformedCache.headings || transformedCache.links) {
			if (true && transformedCache?.blocks && this.sectionInfo) {
				for (const value of transformedCache.blocks) {
					if (
						value.references.length >= minRefCountThreshold &&
						value.pos.start.line >= this.sectionInfo?.lineStart &&
						value.pos.end.line <= this.sectionInfo?.lineEnd
					) {
						const referenceElement = htmlDecorationForReferencesElement(
							value.references.length,
							"block",
							value.references[0].realLink,
							value.key,
							value.references[0]?.resolvedFile?.path ?? "",
							"snw-liveupdate",
							value.pos.start.line,
						);
						let blockElement: HTMLElement | null = this.containerEl.querySelector("p");
						const valueLineInSection: number = value.pos.start.line - this.sectionInfo.lineStart;
						if (!blockElement) {
							blockElement = this.containerEl.querySelector(`li[data-line="${valueLineInSection}"]`);
							if (!blockElement) continue;
							const ulElement = blockElement.querySelector("ul");
							if (ulElement) ulElement.before(referenceElement);
							else blockElement.append(referenceElement);
						} else {
							// if (!blockElement) {
							// 	blockElement = this.containerEl.querySelector(`ol[data-line="${valueLineInSection}"]`);
							// 	blockElement.append(referenceElement);
							// } else {
							blockElement.append(referenceElement);
							// }
						}
						if (blockElement && !blockElement.hasClass("snw-block-preview")) referenceElement.addClass("snw-block-preview");
					}
				}
			}

			if (true && transformedCache?.embeds) {
				// biome-ignore lint/complexity/noForEach: <explanation>
				this.containerEl.querySelectorAll('.internal-embed:not([data-snw-has-badge="1"])').forEach((element) => {
					const src = element.getAttribute("src");
					if (!src) return;

					// Testing for normal links, links within same page starting with # and for ghost links
					const embedPath = src[0] === "#" ? this.currentFile.path.slice(0, -(this.currentFile.extension.length + 1)) + src : src;
					const embedKey = referenceCountingPolicy.generateKeyFromPathAndLink(this.currentFile.path, embedPath);

					for (const value of transformedCache.embeds ?? []) {
						if (value.references.length >= minRefCountThreshold && embedKey === value.key) {
							const referenceElement = htmlDecorationForReferencesElement(
								value.references.length,
								"embed",
								value.references[0].realLink,
								value.key,
								value.references[0]?.resolvedFile?.path ?? "",
								"snw-liveupdate",
								value.pos.start.line,
							);
							referenceElement.addClass("snw-embed-preview");
							element.after(referenceElement);
							element.setAttribute("data-snw-has-badge", "1"); // Mark the embed element
							break;
						}
					}
				});
			}

			if (true && transformedCache?.links) {
				// biome-ignore lint/complexity/noForEach: <explanation>
				// Avoid duplicating badges when the post-processor runs multiple times
				this.containerEl.querySelectorAll('a.internal-link:not([data-snw-has-badge="1"])').forEach((element) => {
					const dataHref = element.getAttribute("data-href");
					if (!dataHref) return;
					// Testing for normal links, links within same page starting with # and for ghost links
					const linkPath =
						dataHref[0] === "#" ? this.currentFile.path.slice(0, -(this.currentFile.extension.length + 1)) + dataHref : dataHref;
					const linkKey = referenceCountingPolicy.generateKeyFromPathAndLink(this.currentFile.path, linkPath);

					for (const value of transformedCache.links ?? []) {
						if (value.references.length >= minRefCountThreshold && linkKey === value.key) {
							const referenceElement = htmlDecorationForReferencesElement(
								value.references.length,
								"link",
								value.references[0].realLink,
								value.key,
								value.references[0]?.resolvedFile?.path ?? "",
								"snw-liveupdate",
								value.pos.start.line,
							);
							referenceElement.addClass("snw-link-preview");
							element.after(referenceElement);
							element.setAttribute("data-snw-has-badge", "1"); // Mark the link element
							break;
						}
					}
				});
			}

			if (true) {
				const headerKey = this.containerEl.querySelector("[data-heading]");
				if (transformedCache?.headings && headerKey) {
					const textContext = headerKey.getAttribute("data-heading");

					for (const value of transformedCache.headings) {
						if (value.references.length >= minRefCountThreshold && value.headerMatch === textContext?.replace(/\[|\]/g, "")) {
							const referenceElement = htmlDecorationForReferencesElement(
								value.references.length,
								"heading",
								value.references[0].realLink,
								value.key,
								value.references[0]?.resolvedFile?.path ?? "",
								"snw-liveupdate",
								value.pos.start.line,
							);
							referenceElement.addClass("snw-heading-preview");
							const headerElement = this.containerEl.querySelector("h1,h2,h3,h4,h5,h6");
							// De-dupe: the preview post-processor can run multiple times on the same section.
							// If this heading already has our badge, skip inserting a second copy.
							if (headerElement && !headerElement.querySelector(".snw-heading-preview")) {
								headerElement.insertAdjacentElement("beforeend", referenceElement);
							}
							break;
						}
					}
				}
			}
		}
	} // end of processMarkdown()
}

/* ────────────────────────── Public API for Implicit Links ────────────────────────── */

/**
 * Binds the same hover behavior that SNW uses for native counters to any element.
 * This ensures consistent popover behavior across all reference badges.
 *
 * @param el The HTML element to bind hover behavior to
 * @param key The reference key (generated by ReferenceCountingPolicy.activePolicy.generateKey)
 * @param snwPlugin The SNW plugin instance
 * @param opts Optional object containing realLink, filePath, display, and refType
 */
export function bindReferenceHover(
	el: HTMLElement,
	key: string,
	snwPlugin: SNWPlugin,
	opts?: { realLink?: string; filePath?: string; display?: string; refType?: string }
) {
	// Set the required data attributes for the hover system
	el.setAttribute("data-snw-key", key);
	el.setAttribute("data-snw-type", opts?.refType ?? "implicit");
	// Only set data-snw-reallink if not already set (preserve pre-set display values)
	if (!el.getAttribute("data-snw-reallink")) {
		el.setAttribute("data-snw-reallink", opts?.realLink ?? key);
	}
	el.setAttribute("data-snw-filepath", opts?.filePath ?? "");
	if (opts?.display) el.setAttribute("data-snw-display", opts.display);
	if (!el.hasAttribute("snw-data-line-number")) el.setAttribute("snw-data-line-number", "0");

	// Add tippy tooltip with the same configuration as native SNW counters
	const requireModifierKey = snwPlugin.settings.requireModifierForHover;
	let showTippy = true;

	const tippyInstance = tippy(el, {
		interactive: true,
		appendTo: () => document.body,
		allowHTML: true,
		zIndex: 9999,
		placement: "auto-end",
		onTrigger(instance, event) {
			const mouseEvent = event as MouseEvent;
			if (requireModifierKey === false) return;
			if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
				showTippy = true;
			} else {
				showTippy = false;
			}
		},
		onShow(instance) {
			if (!showTippy) return false;

			setTimeout(async () => {
				await getUIC_Hoverview(instance);
			}, 1);
		},
	});

	tippyInstance.popper.classList.add("snw-tippy");
	return tippyInstance;
}

/**
 * Imperative "open now" helper for showing the reference popover.
 * Used by bindReferenceHover and can be called directly if needed.
 *
 * @param el The HTML element to show the popover for
 * @param key The reference key
 * @param snwPlugin The SNW plugin instance
 */
export function showReferencePopover(el: HTMLElement, key: string, snwPlugin: SNWPlugin) {
	// Ensure the element has the required data attributes
	el.setAttribute("data-snw-key", key);
	el.setAttribute("data-snw-type", "implicit");
	el.setAttribute("data-snw-reallink", key);
	el.setAttribute("data-snw-filepath", "");
	el.setAttribute("snw-data-line-number", "0");

	// Create a temporary tippy instance to show the popover
	const tippyInstance = tippy(el, {
		interactive: true,
		appendTo: () => document.body,
		allowHTML: true,
		zIndex: 9999,
		placement: "auto-end",
		trigger: "manual", // Manual trigger for imperative show
		onShow(instance) {
			setTimeout(async () => {
				await getUIC_Hoverview(instance);
			}, 1);
		},
	});

	tippyInstance.popper.classList.add("snw-tippy");
	tippyInstance.show();

	// Clean up after a delay
	setTimeout(() => {
		tippyInstance.destroy();
	}, 5000); // Auto-hide after 5 seconds

	return tippyInstance;
}
