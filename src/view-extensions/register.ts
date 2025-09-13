import type SNWPlugin from "../main";

/**
 * Factory function to register inline decorations and implicit links extensions
 * Separates "what we wire" from "when we boot" for cleaner main.ts
 * @param plugin - SNW plugin instance
 */
export const registerInlineAndImplicit = async (plugin: SNWPlugin) => {
	// Register inline decorations extension
	const { inlineDecorationsExtension } = await import("./references-cm6");
	plugin.registerEditorExtension(inlineDecorationsExtension(plugin));
	
	// Register implicit links extension
	const { createInferredLinksExtension } = await import("../implicit-links/manager");
	const implicitExt = createInferredLinksExtension(plugin, {
		debounceMs: 120,
		boundaryMode: "word",
		caseInsensitive: true,
		maxPerChunk: 300,
	});
	plugin.registerEditorExtension(implicitExt);
};
