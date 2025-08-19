import { StateField, StateEffect } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
} from "@codemirror/view";
import type { TFile } from "obsidian";
import { bindReferenceHover } from "./references-preview";

/** Provider output shape (what the virtual providers already return) */
type LinkPos = { start: { offset: number }, end: { offset: number } };
type ImplicitLink = { realLink: string; display?: string; pos: LinkPos };

const setImplicitLinksDeco = StateEffect.define<DecorationSet>();

export const implicitLinksField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(value, tr) {
    const mapped = tr.docChanged ? value.map(tr.changes) : value;
    for (const e of tr.effects) if (e.is(setImplicitLinksDeco)) return e.value;
    return mapped;
  },
  provide: f => EditorView.decorations.from(f),
});

/* ────────────────────────── helpers ────────────────────────── */

function basenameNoExt(pathOrName: string): string {
  const base = (pathOrName.split("/").pop() ?? pathOrName);
  return base.endsWith(".md") ? base.slice(0, -3) : base;
}

/**
 * Generate the same reference key that native SNW counters use.
 * This ensures counts and hover contents match native behavior.
 */
function generateReferenceKey(plugin: any, linktext: string, fromFile: TFile | null): string {
  try {
    // Use the active policy's generateKey method for consistency
    const activePolicy = plugin?.referenceCountingPolicy?.activePolicy;
    if (activePolicy?.generateKey) {
      // Create a Link object structure that matches what SNW uses
      const dest = plugin?.app?.metadataCache?.getFirstLinkpathDest?.(linktext, fromFile?.path ?? "");
      const linkObj = {
        realLink: linktext,
        reference: {
          link: linktext,
          key: `${(dest?.path ?? linktext).toUpperCase()}`,
          displayText: linktext,
          position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } }
        },
        resolvedFile: dest || {
          path: `${linktext}.md`,
          name: `${linktext}.md`,
          basename: linktext,
          extension: "md",
        } as unknown as TFile,
        sourceFile: fromFile,
      };
      
      return activePolicy.generateKey(linkObj);
    }
  } catch {}
  
  // Fallback to the old method if active policy is not available
  const fold = plugin?.wikilinkEquivalencePolicy?.textFold;
  return (typeof fold === "function" ? fold(linktext.trim()) : linktext.trim().toUpperCase());
}

/**
 * Get reference count from SNW's indexed references using the active policy.
 * This is the single source of truth for all reference counts.
 */
function getReferenceCount(plugin: any, key: string): number {
  try {
    const activePolicy = plugin?.referenceCountingPolicy?.activePolicy;
    const indexedRefs = plugin?.referenceCountingPolicy?.indexedReferences;
    const refs = indexedRefs?.get(key);
    
    if (Array.isArray(refs)) {
      // Use policy hooks for filtering and counting if available
      const filteredRefs = activePolicy?.filterReferences?.(refs) ?? refs;
      return activePolicy?.countReferences?.(filteredRefs) ?? filteredRefs.length;
    }
  } catch {}
  return 0;
}

function resolveDest(app: any, linktext: string, fromPath?: string | null) {
  return app?.metadataCache?.getFirstLinkpathDest?.(linktext, fromPath ?? "")
      ?? app?.metadataCache?.getFirstLinkpathDest?.(linktext + ".md", fromPath ?? "")
      ?? null;
}

/* ───────────── Badge Widget ───────────── */

class ImplicitBadgeWidget extends WidgetType {
  constructor(
    private key: string, 
    private linktext: string,
    private plugin: any,
    private app: any,
    private fromFile: TFile | null
  ) {
    super();
  }

  eq(other: ImplicitBadgeWidget) { 
    return other.key === this.key; 
  }

  toDOM() {
    const badge = document.createElement("span");
    badge.className = "snw-implicit-badge";

    // Pull fresh count from the index:
    const count = getReferenceCount(this.plugin, this.key);
    badge.textContent = String(count);
    badge.title = `${this.linktext} • ${count} reference${count === 1 ? "" : "s"}`;
    
    // Use unified hover system - same as native SNW counters
    try {
      bindReferenceHover(badge, this.key, this.plugin);
    } catch (e) {
      console.warn("[ImplicitLinks cm6] Failed to bind hover:", e);
    }
    
    badge.addEventListener("click", (ev) => {
      ev.preventDefault();
      const d = resolveDest(this.app, this.linktext, this.fromFile?.path ?? "");
      if (d) this.app.workspace.openLinkText(d.path, this.fromFile?.path ?? "", false);
      else this.app.workspace.openLinkText(this.linktext, this.fromFile?.path ?? "", false);
    });
    
    return badge;
  }

  ignoreEvent() { return false; }
}

/* ───────────── decorations ───────────── */

function buildDecorations(
  view: EditorView,
  links: ImplicitLink[],
  app: any,
  plugin: any,
  fromFile: TFile | null
): DecorationSet {
  if (!links?.length) return Decoration.none;

  const docLen = view.state.doc.length;
  const ranges: any[] = [];

  for (const l of links) {
    const from = Math.max(0, Math.min(docLen, l.pos?.start?.offset ?? 0));
    const to   = Math.max(0, Math.min(docLen, l.pos?.end?.offset   ?? 0));
    if (to <= from) continue;

    const linktext = (l.display && l.display.trim()) ? l.display : basenameNoExt(l.realLink);
    const key = generateReferenceKey(plugin, linktext, fromFile);
    const count = getReferenceCount(plugin, key);

    // Skip if count is below threshold (same as native SNW behavior)
    if (count < (plugin?.settings?.minimumRefCountThreshold ?? 0)) continue;

    // underline the phrase
    ranges.push(Decoration.mark({ 
      class: "snw-implicit-link",
      attributes: { "data-snw-target": l.realLink, "data-snw-linktext": linktext }
    }).range(from, to));

    // add inline badge after the phrase
    ranges.push(
      Decoration.widget({
        side: 1,
        widget: new ImplicitBadgeWidget(key, linktext, plugin, app, fromFile),
      }).range(to)
    );
  }

  // If your hits are sorted by `from`, pass `true`; otherwise pass `false`.
  return Decoration.set(ranges, true);
}

/** Collect provider results AND (fallback) scan custom phrases if needed. */
async function collectImplicitLinks(view: EditorView): Promise<ImplicitLink[]> {
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
      try { 
        const result = await p({ file, cache, makeLink });
        return result || []; 
      } catch (e) {
        console.warn("[ImplicitLinks cm6] Provider error:", e);
        return []; 
      }
    })
  );
  let links: ImplicitLink[] = batches.flat();

  console.log("[ImplicitLinks cm6] Virtual links found:", links.length);

  /* ── Fallback: scan custom phrases from settings (so `abcdefg` renders) ── */
  try {
    const s = plugin?.settings?.dictionary ?? plugin?.settings?.implicitLinks?.dictionary ?? plugin?.settings ?? {};
    const include = !!(s.sources?.customList ?? s.includeCustomPhrases ?? s.includeCustom);
    if (include) {
      const list: string[] = s.customPhrases ?? s.customList ?? [];
      const minLen = s.minimumPhraseLength ?? s.minPhraseLength ?? 3;
      const requireWB = !!s.requireWordBoundaries;

      const text = view.state.doc.toString();
      for (const raw of list) {
        const phrase = String(raw || "").trim();
        if (phrase.length < minLen) continue;

        const q = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const body = requireWB ? `\\b${q}\\b` : q;
        const re = new RegExp(body, "gi");
        
        for (const m of text.matchAll(re)) {
          const start = m.index ?? 0;
          const end = start + m[0].length;
          links.push({ 
            realLink: `${phrase}.md`, 
            display: phrase, 
            pos: { start: { offset: start }, end: { offset: end } } 
          });
        }
      }
      
      console.log("[ImplicitLinks cm6] Custom phrases found:", links.length - batches.flat().length);
    }
  } catch (e) {
    console.warn("[ImplicitLinks cm6] custom-phrase scan error", e);
  }

  return links;
}

/* ───────────────────────────── View plugin ───────────────────────────── */

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
      const api = (window as any).snwAPI;
      const plugin = api?.plugin;
      const app = plugin?.app;
      const file: TFile | null = app?.workspace?.getActiveFile?.() ?? null;

      const links = await collectImplicitLinks(this.view);
      
      try {
        const deco = buildDecorations(this.view, links, app, plugin, file);
        this.view.dispatch({ effects: setImplicitLinksDeco.of(deco) });
      } catch (e) {
        console.warn("[ImplicitLinks] decoration build failed", e);
        this.view.dispatch({ effects: setImplicitLinksDeco.of(Decoration.none) });
      }
    });
  };

  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged) this.refresh();
  }
});
