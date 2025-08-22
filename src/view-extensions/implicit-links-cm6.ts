import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
  MatchDecorator,
} from "@codemirror/view";
import type { TFile } from "obsidian";
import { bindReferenceHover } from "./references-preview";

/** Provider output shape (what the virtual providers already return) */
type LinkPos = { start: { offset: number }, end: { offset: number } };
type ImplicitLink = { realLink: string; display?: string; pos: LinkPos };

// State for fast, synchronous lookup
export type InferredHit = { from: number; to: number; text: string; target: string; count: number };
export type InferredCache = {
  // Version stamp lets us detect cache changes even if doc didn't change
  version: number;
  // Fast lookup by [from,to] or by text key (choose one)
  bySpan: Set<string>; // `${from}:${to}`
  byText: Map<string, { target: string; count: number }>;
};

export const setInferredCache = StateEffect.define<InferredCache>();

export const inferredCacheField = StateField.define<InferredCache>({
  create() { return { version: 0, bySpan: new Set(), byText: new Map() }; },
  update(value, tr) {
    // Atomic swap on cache update
    for (const e of tr.effects) if (e.is(setInferredCache)) return e.value;
    return value;
  },
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

/* ───────────── Badge Widget (Simplified) ───────────── */

class ImplicitBadgeWidget extends WidgetType {
  constructor(
    private key: string,
    private count: number,
    private plugin: any
  ) {
    super();
  }

  eq(other: ImplicitBadgeWidget) { 
    return this.key === other.key && this.count === other.count; 
  }

  toDOM() {
    const badge = document.createElement("span");
    badge.className = "snw-implicit-badge";
    badge.textContent = String(this.count);
    badge.title = `${this.count} reference${this.count === 1 ? "" : "s"}`;
    
    // Use unified hover system - same as native SNW counters
    try {
      bindReferenceHover(badge, this.key, this.plugin);
    } catch (e) {
      console.warn("[ImplicitLinks cm6] Failed to bind hover:", e);
    }
    
    // Only handle badge click (navigation is handled by ViewPlugin event handlers)
    badge.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Badge click opens reference panel (same as native SNW behavior)
    });
    
    return badge;
  }

  // Optional: avoid detach/attach for count-only updates
  updateDOM(dom: HTMLElement) {
    if (dom.textContent !== String(this.count)) {
      dom.textContent = String(this.count);
      dom.title = `${this.count} reference${this.count === 1 ? "" : "s"}`;
    }
    return true;
  }

  ignoreEvent() { return false; }
}

/* ───────────── Small helper: build mark + badge ───────────── */

function addLinkDecorations(add: any, from: number, to: number, text: string, target: string, count: number) {
  // 1) underline/clickable styling — text stays in DOM
  add(from, to, Decoration.mark({
    class: "internal-link snw-implicit-link",
    attributes: { "data-snw-target": target, "data-snw-linktext": text }
  }));

  // 2) compact badge after the word
  add(to, to, Decoration.widget({
    side: 1,
    widget: new ImplicitBadgeWidget("", count, (window as any).snwAPI?.plugin)
  }));
}

/* ───────────── ViewPlugin using MatchDecorator ───────────── */

export const InferredLinksPlugin = (opts?: { tokenRegex?: RegExp }) => {
  const tokenRe = opts?.tokenRegex ?? /\p{L}[\p{L}\p{N}\- ]{1,80}/gu; // cheap phrase-ish tokens

  const decorator = new MatchDecorator({
    regexp: tokenRe,
    decorate(add, from, to, match, view) {
      const cache = view.state.field(inferredCacheField, false);
      if (!cache) return;

      // Primary lookup: by text (fast); optional secondary by span if you store exact ranges
      const text = match[0].trim();
      const hit = cache.byText.get(text);
      if (!hit || hit.count <= 0) return;

      addLinkDecorations(add, from, to, text, hit.target, hit.count);
    }
  });

  return ViewPlugin.fromClass(class {
    decorations = Decoration.none;
    cacheVersion = 0;

    constructor(readonly view: EditorView) {
      this.rebuild();
    }

    update(u: any) {
      const nextCache = u.state.field(inferredCacheField, false);
      const cacheChanged = nextCache && nextCache.version !== this.cacheVersion;

      if (u.docChanged) {
        // Map first: this keeps old decorations stable while typing
        this.decorations = decorator.updateDeco(u, this.decorations);
      }

      if (cacheChanged || u.docChanged) {
        // Cache changed or doc moved: rebuild from scratch
        this.rebuild();
      }
    }

    rebuild() {
      const builder = new RangeSetBuilder();
      this.decorations = decorator.createDeco(this.view);
      this.cacheVersion = this.view.state.field(inferredCacheField).version;
    }
  }, {
    decorations: v => (v as any).decorations,
    eventHandlers: {
      mousedown(event, view) {
        const linkEl = (event.target as HTMLElement)?.closest?.(".snw-implicit-link") as HTMLElement | null;
        if (!linkEl) return;
        event.preventDefault();
        const target = linkEl.getAttribute("data-snw-target") || "";
        const fromPath = (window as any).snwAPI?.plugin?.app?.workspace?.getActiveFile?.()?.path ?? "";
        const dest = (window as any).snwAPI?.plugin?.app?.metadataCache?.getFirstLinkpathDest?.(target, fromPath);
        (window as any).snwAPI?.plugin?.app?.workspace?.openLinkText(dest?.path || target, fromPath, false);
      },
      click(event, view) {
        const badge = (event.target as HTMLElement)?.closest?.(".snw-implicit-badge");
        if (!badge) return;
        event.preventDefault();
        // Use your existing reference hover/panel opener
        // (processHtmlDecorationReferenceEvent or equivalent)
      }
    }
  });
};

/** Collect provider results AND (fallback) scan custom phrases if needed. */
async function collectImplicitLinksFast(view: EditorView, pluginApi: any): Promise<Array<{from: number, to: number, text: string, target: string, count: number}>> {
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

  // Convert to the format expected by the cache
  const text = view.state.doc.toString();
  const docLen = text.length;
  const items: Array<{from: number, to: number, text: string, target: string, count: number}> = [];

  for (const l of links) {
    const from = Math.max(0, Math.min(docLen, l.pos?.start?.offset ?? 0));
    const to   = Math.max(0, Math.min(docLen, l.pos?.end?.offset   ?? 0));
    if (to <= from) continue;

    const linktext = (l.display && l.display.trim()) ? l.display : basenameNoExt(l.realLink);
    const key = generateReferenceKey(plugin, linktext, file);
    const count = getReferenceCount(plugin, key);

    // Skip if count is below threshold (same as native SNW behavior)
    if (count < (plugin?.settings?.minimumRefCountThreshold ?? 0)) continue;

    items.push({
      from,
      to,
      text: linktext,
      target: l.realLink,
      count
    });
  }

  return items;
}

/* ───────────── Async resolver that only updates the cache ───────────── */

const debounce = <F extends (...a:any[])=>void>(fn: F, ms: number): F => {
  let t: number | undefined;
  // @ts-ignore
  return function(this:any, ...args:any[]) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms) as unknown as number;
  } as F;
};

export const mkInferredLinksController = (plugin: any, debounceMs = 120) => {
  const run = debounce(async (view: EditorView) => {
    const text = view.state.doc.toString();
    if (!text) return;

    // Your existing provider(s)
    const links = await collectImplicitLinksFast(view, plugin);

    const byText = new Map<string, { target: string; count: number }>();
    const bySpan = new Set<string>();
    for (const l of links) {
      byText.set(l.text, { target: l.target, count: l.count });
      bySpan.add(`${l.from}:${l.to}`);
    }

    const cache: InferredCache = { version: Date.now(), byText, bySpan };
    view.dispatch({ effects: setInferredCache.of(cache) });
  }, debounceMs);

  return {
    onViewInit(view: EditorView) { run(view); },
    onUpdate(view: EditorView) {
      // Optional: if you want to refresh on viewport/selection too
      run(view);
    }
  };
};

/* ───────────────────────────── Export function ───────────────────────────── */

export function initImplicitLinksLivePreview(plugin: any) {
  const controller = mkInferredLinksController(plugin, 120);
  const inferredLinksExt = InferredLinksPlugin();

  return [
    inferredCacheField,
    inferredLinksExt,
    // Tiny ViewPlugin only to kick the controller (or reuse your existing VP's update hook)
    EditorView.updateListener.of((u) => {
      if (u.docChanged || u.viewportChanged || u.selectionSet) controller.onUpdate(u.view);
      if (u.startState === u.state) controller.onViewInit(u.view);
    }),
  ];
}
