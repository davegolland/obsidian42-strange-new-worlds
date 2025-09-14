// This file collects all UI initializer functions to make them more maintainable
// by centralizing them in a single place.

import type InferredWikilinksPlugin from "../main";
import { log } from "../diag";

export { setPluginVariableUIC_RefArea } from "./components/uic-ref-area";
export { setPluginVariableForUIC } from "./components/hover-content";
export { setPluginVariableForCM6InlineReferences } from "../view-extensions/references-cm6";

// Add the missing htmlDecorations initializer
export function setPluginVariableForHtmlDecorations(_: InferredWikilinksPlugin) {
	// Stub function - no-op to silence console noise
}

// TEMP dev guard: fail build if bare 'referenceCountingPolicy' sneaks in
// (comment out when clean)
// This will cause a TypeScript error if any bare referenceCountingPolicy exists
// ("referenceCountingPolicy" as any);


