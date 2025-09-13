// This file collects all UI initializer functions to make them more maintainable
// by centralizing them in a single place.

import type SNWPlugin from "../main";
import { log } from "../diag";

export { setPluginVariableUIC_RefArea } from "./components/uic-ref-area";
export { setPluginVariableForUIC } from "./components/uic-ref--parent";
export { setPluginVariableForCM6InlineReferences } from "../view-extensions/references-cm6";

// Add the missing htmlDecorations initializer
export function setPluginVariableForHtmlDecorations(plugin: SNWPlugin) {
	// This function is called to ensure the plugin is available for hover functionality
	// The actual tippy setup is handled in the InlineReferenceWidget.toDOM() method
	log.debug("setPluginVariableForHtmlDecorations: plugin reference set for hover functionality");
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

