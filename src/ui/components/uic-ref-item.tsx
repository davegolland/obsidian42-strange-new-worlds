// Component creates an individual reference item

import { render } from "preact";
import type InferredWikilinksPlugin from "src/main";
import type { Link, SnwReferenceExtras } from "../../types";
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
 * Simple reference item renderer - renders backend structural snippets when available
 */
const grabChunkOfFile = async (ref: Link, plugin: InferredWikilinksPlugin): Promise<HTMLElement> => {
	const container = createDiv();
	container.setAttribute("uic", "uic");

	const wrapper = container.createDiv({ cls: "snw-ref-simple" });
	const contentEl = wrapper.createDiv({ cls: "snw-ref-line" });

	const fallbackText = selectFallbackText(ref);
	const html = ref.snw ? renderSnwSnippet(ref.snw, fallbackText) : formatPlainText(fallbackText);

	contentEl.innerHTML = html;

	return container;
};

function selectFallbackText(ref: Link): string {
	return ref.reference.displayText || ref.reference.link || ref.sourceFile?.basename || "Reference";
}

function renderSnwSnippet(extras: SnwReferenceExtras | undefined, fallback: string): string {
	if (!extras) return formatPlainText(fallback);
	const content = extras.block?.markdown ?? extras.snippet ?? extras.previewOneLine ?? fallback;
	return renderWithHighlights(content, extras.highlights);
}

function renderWithHighlights(content: string, highlights?: Array<[number, number]> | null): string {
	if (!highlights || highlights.length === 0) return formatPlainText(content);

	const ranges = [...highlights]
		.map(([start, end]) => [Math.max(0, start), Math.max(0, end)] as [number, number])
		.filter(([start, end]) => end > start)
		.sort((a, b) => a[0] - b[0]);

	if (!ranges.length) return formatPlainText(content);

	let cursor = 0;
	let html = "";
	const length = content.length;

	for (const [rawStart, rawEnd] of ranges) {
		const start = Math.min(rawStart, length);
		const end = Math.min(rawEnd, length);
		if (end <= cursor) continue;
		if (start > cursor) {
			html += escapeHtml(content.slice(cursor, start));
		}
		const highlightStart = Math.max(cursor, start);
		html += `<span class="snw-ref-highlight">${escapeHtml(content.slice(highlightStart, end))}</span>`;
		cursor = end;
	}

	if (cursor < length) {
		html += escapeHtml(content.slice(cursor));
	}

	return html.replaceAll("\n", "<br>");
}

function formatPlainText(value: string): string {
	return escapeHtml(value).replaceAll("\n", "<br>");
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
