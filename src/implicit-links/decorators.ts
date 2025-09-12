import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type EditorView, MatchDecorator, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { bindReferenceHover } from "../view-extensions/references-preview";
import { isInsideCode, isInsideMarkdownLink, isInsideWikiLink } from "../view-extensions/text-guards";
import { type PhraseInfo, inferredCacheField } from "./cache";
import { generateReferenceKey } from "./shared-utils";

// Using shared guard functions from text-guards.ts

class CountBadge extends WidgetType {
	constructor(
		private count: number,
		private key: string,
		private plugin: any,
		private realLink: string,
		private fromFilePath: string,
		private display: string
	) {
		super();
	}
	eq(other: CountBadge) {
		return this.count === other.count && this.key === other.key;
	}
	toDOM() {
		const el = document.createElement("span");
		el.className = "snw-implicit-badge";
		el.textContent = String(this.count);
		el.title = `${this.count} reference${this.count === 1 ? "" : "s"}`;

		// Set attributes before binding the hover
		el.setAttribute("data-snw-reallink", this.realLink);
		el.setAttribute("data-snw-filepath", this.fromFilePath);

		// Use unified hover system - same as native SNW counters
		try {
			bindReferenceHover(el, this.key, this.plugin, {
				realLink: this.realLink,
				filePath: this.fromFilePath,
				display: this.display,
				refType: "implicit",
			});
		} catch (e) {
			console.warn("[ImplicitLinks decorators] Failed to bind hover:", e);
		}

		return el;
	}
}

// decorate *just* the matched phrase (text stays in DOM)
function addLinkDecos(add: any, from: number, to: number, text: string, info: PhraseInfo, key: string, plugin: any) {
	add(
		from,
		to,
		Decoration.mark({
			class: "internal-link snw-implicit-link",
			attributes: {
				"data-snw-target": info.target,
				"data-snw-linktext": text,
				title: `${text} • ${info.count} reference${info.count === 1 ? "" : "s"}`,
			},
		}),
	);
	// Get the current file for fromFilePath
	const fromFile = plugin?.app?.workspace?.getActiveFile?.() ?? null;
	
	// Log the badge construction
	console.log("[SNW badge] key=%s count=%d target=%s from=%s", key, info.count, info.target, fromFile?.path ?? "");
	
	add(to, to, Decoration.widget({ 
		side: 1, 
		widget: new CountBadge(info.count, key, plugin, info.target, fromFile?.path ?? "", text) 
	}));
}

/** One view plugin per regex chunk. CM6 will merge multiple decoration sources. */
export function makeChunkPlugin(regex: RegExp, plugin: any) {
	const decorator = new MatchDecorator({
		regexp: regex,
		decorate(add, from, to, match, view) {
			const doc = view.state.doc;

			// 1) Skip explicit links to avoid double badges
			if (isInsideWikiLink(doc, from, to)) return;
			if (isInsideMarkdownLink(doc, from, to)) return;

			// 2) (Optional) skip inline code blocks
			if (isInsideCode(doc, from, to)) return;

			// 3) Lookup phrase and decorate (mark + side widget)
			const cache = view.state.field(inferredCacheField, false);
			if (!cache) return;

			const text = match[0];
			const info = cache.byPhrase.get(text.toLowerCase());
			if (!info || info.count <= 0) return;

			// Use the stored key from PhraseInfo instead of recomputing
			const fromFile = plugin?.app?.workspace?.getActiveFile?.() ?? null;
			addLinkDecos(add, from, to, text, info, info.key, plugin);
		},
	});

	return ViewPlugin.fromClass(
		class {
			decorations = Decoration.none;
			constructor(private view: EditorView) {
				this.decorations = decorator.createDeco(view);
			}
			update(u: ViewUpdate) {
				if (u.docChanged) this.decorations = decorator.updateDeco(u, this.decorations);
				// If cache changed (phrasesVersion bump), we must rebuild; handled by the "manager" below.
			}
		},
		{ decorations: (v) => (v as any).decorations },
	);
}

// Helper function now imported from shared-utils.ts
