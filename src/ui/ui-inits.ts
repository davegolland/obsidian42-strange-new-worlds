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

import { implicitLinksField, implicitLinksPlugin } from "../view-extensions/implicit-links-cm6";

// Initialize implicit links Live Preview
export function initImplicitLinksLivePreview(plugin: SNWPlugin) {
	plugin.registerEditorExtension([implicitLinksField, implicitLinksPlugin]);
} 