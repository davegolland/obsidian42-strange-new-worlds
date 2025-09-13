import { Decoration, type EditorView, MatchDecorator, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { isInsideCode, isInsideMarkdownLink, isInsideWikiLink } from "../view-extensions/text-guards";
import { type PhraseInfo, inferredCacheField } from "./cache";
import { getUIC_HoverviewElement } from "../ui/components/uic-ref--parent";
import tippy from "tippy.js";

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

		// Set all required attributes for hover functionality
		el.setAttribute("data-snw-type", "implicit");
		el.setAttribute("data-snw-reallink", this.realLink);
		el.setAttribute("data-snw-key", this.key);
		el.setAttribute("data-snw-filepath", this.fromFilePath);
		el.setAttribute("snw-data-line-number", "0");
		el.setAttribute("data-snw-display", this.display);

		// Set up tippy hover
		const tip = tippy(el, {
			content: "Loading...",
			theme: "snw-tippy",
			appendTo: () => document.body,
			trigger: this.plugin?.settings?.requireModifierForHover ? "manual" : "mouseenter focus",
			interactive: true,
			allowHTML: true,
			onTrigger(instance, ev) {
				const requireMod = this.plugin?.settings?.requireModifierForHover ?? false;
				(instance as any).__snwShouldShow = !requireMod || ((ev as MouseEvent).metaKey || (ev as MouseEvent).ctrlKey);
			},
			onShow: async (instance) => {
				if (!(instance as any).__snwShouldShow) return false;
				// Build the hover DOM and set it as tooltip content
				const contentEl = await getUIC_HoverviewElement({ 
					referenceEl: instance.reference as HTMLElement, 
					plugin: this.plugin 
				});
				if (contentEl) instance.setContent(contentEl);
				return true;
			},
			onHide: () => {
				// Clean up if needed
			}
		});


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
	// Log the badge construction (only in dev mode)
	if (plugin?.settings?.dev?.diagDecorations) {
		const fromFile = plugin?.app?.workspace?.getActiveFile?.() ?? null;
		console.log("[SNW badge] key=%s count=%d target=%s from=%s", key, info.count, info.target, fromFile?.path ?? "");
	}
	
	// Get the current file for fromFilePath
	const fromFile = plugin?.app?.workspace?.getActiveFile?.() ?? null;
	
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
		{ decorations: (v) => v.decorations },
	);
}

// Helper function now imported from shared-utils.ts
