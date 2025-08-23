// This file collects all UI initializer functions to make them more maintainable
// by centralizing them in a single place.

import type SNWPlugin from "../main";
import { setPluginVariableForDebouncedHelpers as setDebouncedHelpersPlugin } from "./debounced-helpers";

export { setPluginVariableUIC_RefArea } from "./components/uic-ref-area";
export { setPluginVariableForUIC } from "./components/uic-ref--parent";
export { setPluginVariableForFrontmatterLinksRefCount } from "./frontmatterRefCount";
export { setPluginVariableForHeaderRefCount } from "./headerRefCount";
export { setPluginVariableForCM6Gutter } from "../view-extensions/gutters-cm6";
export { setPluginVariableForHtmlDecorations } from "../view-extensions/htmlDecorations";
export { setPluginVariableForCM6InlineReferences } from "../view-extensions/references-cm6";
export { setPluginVariableForMarkdownPreviewProcessor } from "../view-extensions/references-preview";
// Initialize the debounced helpers module
export function initDebouncedHelpers(plugin: SNWPlugin) {
	setDebouncedHelpersPlugin(plugin);
}

import { createInferredLinksExtension } from "../implicit-links/manager";

function assertValidExtensions(exts: any[], label: string) {
	// Flatten and sanity-check for Promises/POJOs that CM rejects
	const flat = exts.flat ? exts.flat(Number.POSITIVE_INFINITY) : exts;
	for (const e of flat) {
		if (!e) throw new Error(`[${label}] falsy extension entry`);
		if (typeof e === "function") continue; // CM6 accepts functions (e.g., Prec)
		if (Array.isArray(e)) throw new Error(`[${label}] nested array in extensions`);
		if (typeof e === "object" && "then" in e) throw new Error(`[${label}] Promise in extensions`);
	}
	return flat;
}

// Initialize implicit links Live Preview (flicker-free)
export function initImplicitLinksLivePreview(plugin: SNWPlugin) {
	const implicitExt = createInferredLinksExtension(plugin, {
		debounceMs: 120,
		boundaryMode: "word",
		caseInsensitive: true,
		maxPerChunk: 300,
	});
	const validExtensions = assertValidExtensions(implicitExt, "implicit-links");

	// Debug logging removed for production

	plugin.registerEditorExtension(validExtensions);
}
