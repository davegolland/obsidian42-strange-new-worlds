// Component creates an individual reference item

import { MarkdownRenderer } from "obsidian";
import { render } from "preact";
import type SNWPlugin from "src/main";
import type { Link } from "../../types";
import { ATTR } from "../attr";
// Context imports removed - context directory was deleted
// Simple fallback implementations below

// Fallback implementations for deleted context functions
function getTextAtPosition(text: string, pos: any): string {
	if (!pos || typeof pos.start !== 'object' || typeof pos.start.offset !== 'number') return "";
	const start = pos.start.offset;
	const end = pos.end?.offset ?? start;
	return text.slice(start, end);
}

class ContextBuilder {
	constructor(private fileContents: string, private fileCache: any) {}
	
	buildContextForLink(link: Link): string {
		return `Reference to ${link.reference.link}`;
	}
}

function formatHeadingBreadCrumbs(breadcrumbs: any[]): string {
	return breadcrumbs.map(b => b.heading).join(" > ");
}

function formatListBreadcrumbs(fileContents: string, breadcrumbs: any[]): string {
	return breadcrumbs.map(b => b.text || "").join(" > ");
}

function formatListWithDescendants(fileContents: string, item: any): string {
	return item.text || "";
}

export function setPluginVariableUIC_RefItem(snwPlugin: SNWPlugin) {
	// No longer needed - plugin is injected as parameter
}

export const getUIC_Ref_Item = async (ref: Link, plugin: SNWPlugin): Promise<HTMLElement> => {
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
 * Grabs a block from a file, then runs it through a markdown render
 *
 * @param {Link} ref
 * @return {*}  {Promise<string>}
 */
const grabChunkOfFile = async (ref: Link, plugin: SNWPlugin): Promise<HTMLElement> => {
	const fileContents = await plugin.app.vault.cachedRead(ref.sourceFile);
	const fileCache = plugin.app.metadataCache.getFileCache(ref.sourceFile);
	const linkPosition = ref.reference.position;

	const container = createDiv();
	container.setAttribute("uic", "uic"); //used to track if this is UIC element.

	if (ref.reference?.key) {
		const key = ref.reference.key;
		const pos = linkPosition; // CodeMirror position for the property/value
		const fmPos = fileCache?.frontmatterPosition;
		const isFrontmatter = !!fmPos && pos && pos.start.line >= fmPos.start.line && pos.end.line <= fmPos.end.line;

		// Extract a single "evidence" line (or YAML entry) containing the hit
		const fullText = fileContents;
		let lineStart = 0,
			lineEnd = fullText.length;
		if (pos?.start) {
			const startOff = pos.start.offset ?? 0;
			lineStart = fullText.lastIndexOf("\n", startOff) + 1;
			lineEnd = fullText.indexOf("\n", startOff);
			if (lineEnd === -1) lineEnd = fullText.length;
		}
		let evidence = fullText.slice(lineStart, lineEnd);

		// Fallback: try to find the "key:" line in YAML/frontmatter if pos is fuzzy
		if (!evidence || !evidence.trim()) {
			const keyRegex = new RegExp(`^\\s*${key}\\s*[:=]`, "mi");
			const m = keyRegex.exec(fullText);
			if (m) {
				const s = m.index;
				const ls = fullText.lastIndexOf("\n", s) + 1;
				const le = fullText.indexOf("\n", s);
				evidence = fullText.slice(ls, le === -1 ? fullText.length : le);
			}
		}

		// If we still didn't get a line, synthesize one from the cached value
		if (!evidence || !evidence.trim()) {
			const valueFromPos = getTextAtPosition(fullText, pos) ?? "";
			evidence = `${key}: ${valueFromPos}`.trim();
		}

		// Light highlighting of the matched portion
		const valueText = getTextAtPosition(fullText, pos) ?? "";
		const escaped = (s: string) =>
			s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
		const highlighted =
			valueText && evidence.includes(valueText)
				? escaped(evidence).replace(new RegExp(valueText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `<mark class="snw-ref-hit">$&</mark>`)
				: escaped(evidence);

		// Render as YAML block if we're in frontmatter, otherwise as a simple code line
		const md = isFrontmatter ? "```yaml\n" + evidence + "\n```" : "`" + evidence + "`";

		// Use MarkdownRenderer for consistent Obsidian styling
		const wrapper = container.createDiv({ cls: "snw-ref-property-snippet" });
		await MarkdownRenderer.render(plugin.app, md, wrapper, ref.sourceFile.path, plugin);

		// If we rendered a code block (frontmatter), add visual highlight overlay
		if (!isFrontmatter) {
			// For inline code, MarkdownRenderer already produced <code>…</code>,
			// so we post-inject the <mark> highlight.
			const code = wrapper.querySelector("code");
			if (code) code.innerHTML = highlighted;
		} else {
			// For YAML blocks, highlight in the pre/code as well
			const code = wrapper.querySelector("pre code");
			if (code) code.innerHTML = highlighted;
		}

		return container;
	}
	const contextBuilder = new ContextBuilder(fileContents, fileCache);

	const headingBreadcrumbs = contextBuilder.getHeadingBreadcrumbs(linkPosition);
	if (headingBreadcrumbs.length > 0) {
		const headingBreadcrumbsEl = container.createDiv();
		headingBreadcrumbsEl.addClass("snw-breadcrumbs");

		headingBreadcrumbsEl.createEl("span", { text: "H" });

		await MarkdownRenderer.render(
			plugin.app,
			formatHeadingBreadCrumbs(headingBreadcrumbs),
			headingBreadcrumbsEl,
			ref.sourceFile.path,
			plugin,
		);
	}

	const indexOfListItemContainingLink = contextBuilder.getListItemIndexContaining(linkPosition);
	const isLinkInListItem = indexOfListItemContainingLink >= 0;

	if (isLinkInListItem) {
		const listBreadcrumbs = contextBuilder.getListBreadcrumbs(linkPosition);

		if (listBreadcrumbs.length > 0) {
			const contextEl = container.createDiv();
			contextEl.addClass("snw-breadcrumbs");

			contextEl.createEl("span", { text: "L" });

			await MarkdownRenderer.render(
				plugin.app,
				formatListBreadcrumbs(fileContents, listBreadcrumbs),
				contextEl,
				ref.sourceFile.path,
				plugin,
			);
		}

		const listItemWithDescendants = contextBuilder.getListItemWithDescendants(indexOfListItemContainingLink);

		const contextEl = container.createDiv();
		await MarkdownRenderer.render(
			plugin.app,
			formatListWithDescendants(fileContents, listItemWithDescendants),
			contextEl,
			ref.sourceFile.path,
			plugin,
		);
	} else {
		const sectionContainingLink = contextBuilder.getSectionContaining(linkPosition);

		let blockContents = "";

		if (sectionContainingLink?.position !== undefined) blockContents = getTextAtPosition(fileContents, sectionContainingLink.position);

		const regex = /^\[\^([\w]+)\]:(.*)$/;
		if (regex.test(blockContents)) blockContents = blockContents.replace("[", "").replace("]:", "");

		await MarkdownRenderer.render(plugin.app, blockContents, container, ref.sourceFile.path, plugin);
	}

	const headingThatContainsLink = contextBuilder.getHeadingContaining(linkPosition);
	if (headingThatContainsLink) {
		const firstSectionPosition = contextBuilder.getFirstSectionUnder(headingThatContainsLink.position);
		if (firstSectionPosition) {
			const contextEl = container.createDiv();
			await MarkdownRenderer.render(
				plugin.app,
				getTextAtPosition(fileContents, firstSectionPosition.position),
				contextEl,
				ref.sourceFile.path,
				plugin,
			);
		}
	}

	// add highlight to the link
	const elems = container.querySelectorAll("*");
	const res = Array.from(elems).find((v) => v.textContent === ref.reference.displayText);
	try {
		// this fails in some edge cases, so in that case, just ignore
		res.addClass("search-result-file-matched-text");
	} catch (error) {
		//@ts-ignore
	}

	return container;
};
