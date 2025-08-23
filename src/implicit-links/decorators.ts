import { MatchDecorator, Decoration, ViewPlugin, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { inferredCacheField, PhraseInfo } from "./cache";
import { bindReferenceHover } from "../view-extensions/references-preview";
import { generateReferenceKey } from "./shared-utils";
import { isInsideWikiLink, isInsideMarkdownLink, isInsideCode } from "../view-extensions/text-guards";

// Using shared guard functions from text-guards.ts

class CountBadge extends WidgetType {
  constructor(private count: number, private key: string, private plugin: any) { super(); }
  eq(other: CountBadge) { return this.count === other.count && this.key === other.key; }
  toDOM() {
    const el = document.createElement("span");
    el.className = "snw-implicit-badge";
    el.textContent = String(this.count);
    el.title = `${this.count} reference${this.count === 1 ? "" : "s"}`;
    
    // Use unified hover system - same as native SNW counters
    try {
      bindReferenceHover(el, this.key, this.plugin);
    } catch (e) {
      console.warn("[ImplicitLinks decorators] Failed to bind hover:", e);
    }
    
    return el;
  }
}

// decorate *just* the matched phrase (text stays in DOM)
function addLinkDecos(add: any, from: number, to: number, text: string, info: PhraseInfo, key: string, plugin: any) {
  add(from, to, Decoration.mark({
    class: "internal-link snw-implicit-link",
    attributes: {
      "data-snw-target": info.target,
      "data-snw-linktext": text,
      "title": `${text} • ${info.count} reference${info.count === 1 ? "" : "s"}`
    }
  }));
  add(to, to, Decoration.widget({ side: 1, widget: new CountBadge(info.count, key, plugin) }));
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

      // Generate reference key for consistent behavior with native SNW
      const fromFile = plugin?.app?.workspace?.getActiveFile?.() ?? null;
      const key = generateReferenceKey(plugin, text, fromFile);
      addLinkDecos(add, from, to, text, info, key, plugin);
    }
  });

  return ViewPlugin.fromClass(class {
    decorations = Decoration.none;
    constructor(private view: EditorView) {
      this.decorations = decorator.createDeco(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = decorator.updateDeco(u, this.decorations);
      // If cache changed (phrasesVersion bump), we must rebuild; handled by the "manager" below.
    }
  }, { decorations: v => (v as any).decorations });
}

// Helper function now imported from shared-utils.ts
