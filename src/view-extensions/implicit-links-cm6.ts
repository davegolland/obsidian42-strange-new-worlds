import { StateField, StateEffect } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import type { TFile } from "obsidian";

/** Provider output shape (what our virtual providers already return) */
type LinkPos = { start: { offset: number }, end: { offset: number } };
type ImplicitLink = { realLink: string; display?: string; pos: LinkPos };

const setImplicitLinksDeco = StateEffect.define<DecorationSet>();

export const implicitLinksField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(value, tr) {
    if (tr.docChanged) value = value.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setImplicitLinksDeco)) return e.value;
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f),
});

class EndBadge extends WidgetType {
  toDOM() {
    const s = document.createElement("span");
    s.className = "snw-implicit-link-badge";
    s.textContent = "·";
    return s;
  }
  ignoreEvent() { return true; }
}

function buildDecorations(view: EditorView, links: ImplicitLink[]): DecorationSet {
  const docLen = view.state.doc.length;
  const ranges: any[] = [];
  for (const l of links) {
    const from = Math.max(0, Math.min(docLen, l.pos?.start?.offset ?? 0));
    const to   = Math.max(0, Math.min(docLen, l.pos?.end?.offset   ?? 0));
    if (to <= from) continue;
    ranges.push(
      Decoration.mark({ class: "snw-implicit-link", attributes: { "data-snw-target": l.realLink }}).range(from, to),
      Decoration.widget({ widget: new EndBadge(), side: 1 }).range(to),
    );
  }
  return ranges.length ? Decoration.set(ranges) : Decoration.none;
}

async function collectFromProviders(view: EditorView): Promise<ImplicitLink[]> {
  const api = (window as any).snwAPI;
  const plugin = api?.plugin;
  if (!plugin) return [];
  const file: TFile | null = plugin.app.workspace.getActiveFile?.() ?? null;
  if (!file) return [];

  const cache = plugin.referenceCountingPolicy?.getSNWCacheByFile?.(file) ?? null;
  const providers =
    (typeof api?.getVirtualLinkProviders === "function"
      ? api.getVirtualLinkProviders()
      : plugin.implicitLinksManager?.providers) || [];

  const makeLink = (realLink: string, display: string | undefined, pos: any): ImplicitLink =>
    ({ realLink, display, pos });

  const batches = await Promise.all(
    providers.map(async (p: any) => {
      try { return (await p({ file, cache, makeLink })) || []; }
      catch { return []; }
    })
  );
  return batches.flat();
}

export const implicitLinksPlugin = ViewPlugin.fromClass(class {
  private raf: number | null = null;
  constructor(private view: EditorView) { this.refresh(); this.hook(); }

  private hook() {
    const plugin = (window as any).snwAPI?.plugin;
    plugin?.app?.workspace?.on?.("file-open", this.refresh);
    plugin?.app?.metadataCache?.on?.("changed", this.refresh);
    plugin?.referenceCountingPolicy?.onRebuilt?.(this.refresh);
  }

  private refresh = () => {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(async () => {
      const links = await collectFromProviders(this.view);
      const deco  = buildDecorations(this.view, links);
      this.view.dispatch({ effects: setImplicitLinksDeco.of(deco) });
      console.log("[ImplicitLinks cm6] decorating", links.length, links.slice(0,3));
    });
  };

  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged) this.refresh();
  }
});
