import { Compartment, StateEffect, Transaction } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { inferredCacheField, setInferredCache, InferredCache, PhraseInfo } from "./cache";
import { buildPhraseRegexChunks } from "./regex";
import { makeChunkPlugin } from "./decorators";
import type { TFile } from "obsidian";
import { generateReferenceKey, getReferenceCount, basenameNoExt } from "./shared-utils";

// Simple debounce
const debounce = <F extends (...a:any[])=>void>(fn: F, ms: number): F => {
  let t: number | undefined;
  // @ts-ignore
  return function(this:any, ...args:any[]) {
    clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms) as any;
  } as F;
};

/** Build a stable list of phrases (keys) from provider results */
function phrasesFromProviderMap(map: Map<string, PhraseInfo>): string[] {
  return Array.from(map.keys());
}

/** Convert existing provider results to phrase info map */
async function computePhraseInfo(text: string, plugin: any): Promise<Map<string, PhraseInfo>> {
  const byPhrase = new Map<string, PhraseInfo>();
  
  try {
    const file: TFile | null = plugin.app.workspace.getActiveFile?.() ?? null;
    if (!file) return byPhrase;

    const cache = plugin.referenceCountingPolicy?.getSNWCacheByFile?.(file) ?? null;
    const providers = plugin.implicitLinksManager?.providers || [];

    const makeLink = (realLink: string, display: string | undefined, pos: any) => ({
      realLink, display, pos
    });

    const batches = await Promise.all(
      providers.map(async (p: any) => {
        try { 
          const result = await p({ file, cache, makeLink });
          return result || []; 
        } catch (e) {
          console.warn("[ImplicitLinks manager] Provider error:", e);
          return []; 
        }
      })
    );
    
    let links = batches.flat();

    // Fallback: scan custom phrases from settings
    // DISABLED: Using DetectionManager approach instead to avoid duplicates
    // try {
    //   const s = plugin?.settings?.dictionary ?? plugin?.settings?.implicitLinks?.dictionary ?? plugin?.settings ?? {};
    //   const include = !!(s.sources?.customList ?? s.includeCustomPhrases ?? s.includeCustom);
    //   if (include) {
    //     const list: string[] = s.customPhrases ?? s.customList ?? [];
    //     const minLen = s.minimumPhraseLength ?? s.minPhraseLength ?? 3;
    //     const requireWB = !!s.requireWordBoundaries;

    //     for (const raw of list) {
    //       const phrase = String(raw || "").trim();
    //       if (phrase.length < minLen) continue;

    //       const q = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    //       const body = requireWB ? `\\b${q}\\b` : q;
    //       const re = new RegExp(body, "gi");
          
    //       for (const m of text.matchAll(re)) {
    //         const start = m.index ?? 0;
    //         const end = start + m[0].length;
    //         links.push({ 
    //           realLink: `${phrase}.md`, 
    //           display: phrase, 
    //           pos: { start: { offset: start }, end: { offset: end } } 
    //         });
    //       }
    //     }
    //   }
    // } catch (e) {
    //   console.warn("[ImplicitLinks manager] custom-phrase scan error", e);
    // }

    // Convert to phrase info map
    for (const l of links) {
      const linktext = (l.display && l.display.trim()) ? l.display : l.realLink.replace(/\.md$/, '');
      const key = generateReferenceKey(plugin, linktext, file);
      const count = getReferenceCount(plugin, key);

      // Skip if count is below threshold (same as native SNW behavior)
      if (count < (plugin?.settings?.minimumRefCountThreshold ?? 0)) continue;

      byPhrase.set(linktext.toLowerCase(), {
        target: l.realLink,
        count
      });
    }

  } catch (e) {
    console.warn("[ImplicitLinks manager] Error computing phrase info:", e);
  }

  return byPhrase;
}

// Helper functions now imported from shared-utils.ts

/** Create + manage chunked decorators. Returns a CM6 extension array. */
export function createInferredLinksExtension(plugin: any, opts?: {
  debounceMs?: number;
  boundaryMode?: "word" | "loose" | "none";
  caseInsensitive?: boolean;
  maxPerChunk?: number;
}) {
  const cfg = { debounceMs: 120, boundaryMode: "word" as const, caseInsensitive: true, maxPerChunk: 300, ...(opts||{}) };

  // Compartment holds the dynamic array of chunk plugins; we'll reconfigure when phrases change
  const chunksCompartment = new Compartment();

  // Controller: refresh cache (counts/targets) asynchronously
  const runRefresh = debounce(async (view: EditorView) => {
    const text = view.state.doc.toString();
    if (!text) return;

    // 1) Ask your provider(s) for inferred links for THIS document text.
    // Should return Map<normalizedPhrase, { target, count }>
    const byPhrase: Map<string, PhraseInfo> = await computePhraseInfo(text, plugin);

    // 2) Build new cache
    const newCache: InferredCache = {
      byPhrase,
      totalPhrases: byPhrase.size,
      phrasesVersion: Date.now(), // bump to force rebuild of regex chunks
    };

    // 3) Update field atomically
    view.dispatch({ effects: setInferredCache.of(newCache) });

    // 4) Rebuild regex chunks + chunk plugins (only when PHRASE SET changed)
    const phrases = phrasesFromProviderMap(byPhrase);
    const regexes = buildPhraseRegexChunks(phrases, {
      boundaryMode: cfg.boundaryMode,
      caseInsensitive: cfg.caseInsensitive,
      maxPerChunk: cfg.maxPerChunk
    });
    const chunkExts = regexes.map(regex => makeChunkPlugin(regex, plugin));

    // Reconfigure the compartment with new chunk plugins
    view.dispatch({
      effects: chunksCompartment.reconfigure(chunkExts)
    });
  }, cfg.debounceMs);

  // A tiny ViewPlugin to call runRefresh on edits/viewport changes
  const Driver = ViewPlugin.fromClass(class {
    composing = false;
    constructor(readonly view: EditorView) { runRefresh(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) runRefresh(u.view);
      
      // Check for implicit links refresh trigger
      const refreshTriggered = u.transactions?.some(tr => 
        tr.annotation(Transaction.userEvent) === "implicit-links-refresh"
      );
      if (refreshTriggered) {
        runRefresh(u.view);
      }
    }
  }, {
    eventHandlers: {
      compositionstart() { (this as any).composing = true; },
      compositionend()  { (this as any).composing = false; runRefresh((this as any).view); },
      // Navigation on click (delegate on the mark)
      mousedown(ev, view) {
        const el = (ev.target as HTMLElement)?.closest?.(".snw-implicit-link") as HTMLElement | null;
        if (!el) return;
        ev.preventDefault();
        const toPath = el.getAttribute("data-snw-target") || "";
        const from   = plugin?.app?.workspace?.getActiveFile?.()?.path ?? "";
        const dest = plugin?.app?.metadataCache?.getFirstLinkpathDest?.(toPath, from);
        plugin?.app?.workspace?.openLinkText?.(dest?.path ?? toPath, from, false);
      },
      click(ev, view) {
        const badge = (ev.target as HTMLElement)?.closest?.(".snw-implicit-badge");
        if (!badge) return;
        ev.preventDefault();
        // Open your references panel here if desired
      }
    }
  });

  // Return the whole extension: cache field + dynamic chunk compartment + driver
  return [
    inferredCacheField,
    chunksCompartment.of([]),  // starts empty; populated after first refresh
    Driver,
  ];
}
