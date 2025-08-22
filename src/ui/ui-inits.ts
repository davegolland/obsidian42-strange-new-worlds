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
  const flat = exts.flat ? exts.flat(Infinity) : exts;
  for (const e of flat) {
    if (!e) throw new Error(`[${label}] falsy extension entry`);
    if (typeof e === "function") continue;            // CM6 accepts functions (e.g., Prec)
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
		maxPerChunk: 300
	});
	const validExtensions = assertValidExtensions(implicitExt, "implicit-links");
	
	// Quick sanity print to confirm singletons
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const cmStateA = require("@codemirror/state");
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const cmViewA  = require("@codemirror/view");
		console.log("[implicit-links] CM6 singletons", {
			stateVersion: cmStateA?.StateField?.toString?.().slice(0,40),
			viewVersion: cmViewA?.EditorView?.toString?.().slice(0,40),
		});
	} catch {}
	
	// Sanity check: show which file paths Node resolved for CM6
	try {
		console.log("[implicit-links] CM6 paths:");
		console.log("STATE PATH", require.resolve("@codemirror/state"));
		console.log("VIEW PATH ", require.resolve("@codemirror/view"));
	} catch {}
	
	plugin.registerEditorExtension(validExtensions);
} 