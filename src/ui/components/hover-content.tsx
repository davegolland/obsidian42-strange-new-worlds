import { Keymap, Notice } from "obsidian";
import type SNWPlugin from "src/main";
import { scrollResultsIntoView } from "src/utils";
import { getUIC_Ref_Area } from "./uic-ref-area";
import { setPluginVariableUIC_RefItem } from "./uic-ref-item";
import { ATTR } from "../attr";
import { passesHoverGate } from "../modifier";

export function setPluginVariableForUIC(snwPlugin: SNWPlugin) {
	setPluginVariableUIC_RefItem(snwPlugin);
}


/**
 * Builds a hover popover element for displaying reference information
 * @param ctx - Context containing reference element and plugin instance
 * @returns Promise resolving to the hover popover HTMLElement
 */
export const buildHoverPopover = async (ctx: { referenceEl: HTMLElement, plugin: SNWPlugin }): Promise<HTMLElement> => {
	const { referenceEl, plugin } = ctx;
	
	// Read data attributes from referenceEl
	const refType = referenceEl.getAttribute(ATTR.type) || "";
	const realLink = referenceEl.getAttribute(ATTR.realLink) || "";
	const key = referenceEl.getAttribute(ATTR.key) || "";
	const filePath = referenceEl.getAttribute(ATTR.file) || "";
	const lineNu = Number(referenceEl.getAttribute(ATTR.line)) || 0;
	const display = referenceEl.getAttribute(ATTR.display) || undefined;
	
	// Build the popover DOM
	const popoverEl = createDiv();
	popoverEl.addClass("snw-popover-container");
	popoverEl.addClass("search-result-container");
	popoverEl.appendChild(await getUIC_Ref_Area(refType, realLink, key, filePath, lineNu, true, plugin, display));
	
	// Set up event handlers
	requestAnimationFrame(() => { void wireHoverEvents(plugin, popoverEl); });
	scrollResultsIntoView(popoverEl);
	
	return popoverEl;
};


/**
 * Wires hover events for file links and reference items using event delegation
 * @param plugin - SNW plugin instance
 * @param rootElementForViewEl - Root element to attach handlers to
 */
export const wireHoverEvents = async (plugin: SNWPlugin, rootElementForViewEl: HTMLElement) => {
	// CLICK event delegation
	rootElementForViewEl.addEventListener("click", async (e: MouseEvent) => {
		const handlerElement = (e.target as HTMLElement).closest(".snw-ref-item-file, .snw-ref-item-info, .snw-ref-title-popover-label");
		if (!handlerElement) return;
		
		e.preventDefault();
		let lineNu = Number(handlerElement.getAttribute(ATTR.line));
		const filePath = handlerElement.getAttribute(ATTR.fileName);
		const fileT = app.metadataCache.getFirstLinkpathDest(filePath, filePath);

		if (!fileT) {
			new Notice(`File not found: ${filePath}. It may be a broken link.`);
			return;
		}

		// Use Obsidian's native openLinkText for header/block navigation
		const titleKey = handlerElement.getAttribute(ATTR.titleKey);
		if (titleKey) {
			// Build linkText for Obsidian's openLinkText (e.g., "path#Heading" or "path#^blockid")
			const linkText = `${filePath}${titleKey}`;
			plugin.app.workspace.openLinkText(linkText, "", Keymap.isModEvent(e));
		} else {
			// Fallback to simple file open
			plugin.app.workspace.getLeaf(Keymap.isModEvent(e)).openFile(fileT);
		}
	});

	// MOUSEOVER event delegation
	if (plugin.app.internalPlugins.plugins["page-preview"].enabled === true) {
		rootElementForViewEl.addEventListener("mouseover", (e: PointerEvent) => {
			const target = e.target as HTMLElement;
			const handlerElement = target.closest(".snw-ref-item-file, .snw-ref-item-info, .snw-ref-title-popover-label");
			if (!handlerElement) return;
			
			e.preventDefault();
			const hoverMetaKeyRequired = plugin.settings.requireModifierForHover;
			if (passesHoverGate(hoverMetaKeyRequired, e)) {
				const previewLocation = {
					scroll: Number(target.getAttribute(ATTR.line)),
				};
				const filePath = target.getAttribute(ATTR.fileName);
				if (filePath) {
					// parameter signature for link-hover parent: HoverParent, targetEl: HTMLElement, linkText: string, sourcePath: string, eState: EphemeralState
					app.workspace.trigger("link-hover", {}, target, filePath, "", previewLocation);
				}
			}
		});
	}
};

