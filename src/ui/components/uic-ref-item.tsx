// Component creates an individual reference item

import { MarkdownRenderer } from "obsidian";
import { render } from "preact";
import type InferredWikilinksPlugin from "src/main";
import type { Link } from "../../types";
import { ATTR } from "../attr";

export function setPluginVariableUIC_RefItem(inferredWikilinksPlugin: InferredWikilinksPlugin) {
	// No longer needed - plugin is injected as parameter
}

export const getUIC_Ref_Item = async (ref: Link, plugin: InferredWikilinksPlugin): Promise<HTMLElement> => {
	const startLine = ref.reference.position !== undefined ? ref.reference.position.start.line.toString() : "0";

	const itemElJsx = (
		<div
			className="snw-ref-item-info search-result-file-match"
			{...{ [ATTR.line]: startLine }}
			{...{ [ATTR.fileName]: ref?.sourceFile?.path }}
			data-href={ref?.sourceFile?.path}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
			dangerouslySetInnerHTML={{
				__html: (await grabChunkOfFile(ref, plugin)).innerHTML,
			}}
		/>
	);

	const itemEl = createDiv();
	render(itemElJsx, itemEl);

	return itemEl;
};

/**
 * Simple reference item renderer - just shows backend data without complex context
 */
const grabChunkOfFile = async (ref: Link, plugin: InferredWikilinksPlugin): Promise<HTMLElement> => {
	const container = createDiv();
	container.setAttribute("uic", "uic");

	// Simple display of the reference information from backend
	const displayText = ref.reference.displayText || ref.reference.link || "Reference";
	const lineNumber = ref.reference.position?.start?.line || 0;
	
	// Create a simple reference display
	const wrapper = container.createDiv({ cls: "snw-ref-simple" });
	
	// Show line number and reference text
	const lineEl = wrapper.createDiv({ cls: "snw-ref-line" });
	lineEl.setText(`Line ${lineNumber + 1}: ${displayText}`);
	
	// Add a subtle highlight
	lineEl.addClass("search-result-file-matched-text");

	return container;
};
