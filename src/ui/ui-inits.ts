// This file collects all UI initializer functions to make them more maintainable
// by centralizing them in a single place.

import type SNWPlugin from "../main";
import { log } from "../diag";

export { setPluginVariableUIC_RefArea } from "./components/uic-ref-area";
export { setPluginVariableForUIC } from "./components/uic-ref--parent";
export { setPluginVariableForCM6InlineReferences } from "../view-extensions/references-cm6";

// Add the missing htmlDecorations initializer
export function setPluginVariableForHtmlDecorations(_: SNWPlugin) {
	// Stub function - no-op to silence console noise
}


