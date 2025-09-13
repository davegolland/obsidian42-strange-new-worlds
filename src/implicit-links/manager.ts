import { Compartment, StateEffect, Transaction } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type { TFile } from "obsidian";
import { type InferredCache, type PhraseInfo, inferredCacheField, setInferredCache } from "./cache";
import { makeChunkPlugin } from "./decorators";
import { ATTR } from "../ui/attr";
import { log } from "../diag";
// buildPhraseRegexChunks implementation (moved from deleted regex.ts)
type PhraseRegexOpts = {
	caseInsensitive?: boolean; // default true
	boundaryMode?: "word" | "loose" | "none"; // default "word"
	maxPerChunk?: number; // default 300
};

const ESC = /[.*+?^${}()|[\]\\]/g;
const escapeRe = (s: string) => s.replace(ESC, "\\$&");

// naive normalize that mirrors your "cache key" normalization
const norm = (s: string) => s.trim().toLowerCase();

function boundaryWrap(pattern: string, mode: PhraseRegexOpts["boundaryMode"]) {
	if (mode === "none") return pattern;
	// Unicode-aware "word" boundaries: letters on either side break the match.
	// Requires the /u flag and modern Chromium (Obsidian is fine).
	const left = mode === "word" ? "(?<!\\p{L})" : "(?<=^|\\s|[\\p{P}])";
	const right = mode === "word" ? "(?!\\p{L})" : "(?=$|\\s|[\\p{P}])";
	return `${left}(?:${pattern})${right}`;
}

/** Build 1..N regex chunks that match ANY of the phrases. */
function buildPhraseRegexChunks(phrases: string[], opts: PhraseRegexOpts = {}): RegExp[] {
	const { caseInsensitive = true, boundaryMode = "word", maxPerChunk = 300 } = opts;

	// Sort longest-first to prefer longer matches when alternation conflicts
	const uniq = Array.from(new Set(phrases.map(norm)));
	uniq.sort((a, b) => b.length - a.length);

	const flags = "gu" + (caseInsensitive ? "i" : "");
	const chunks: RegExp[] = [];

	for (let i = 0; i < uniq.length; i += maxPerChunk) {
		const batch = uniq.slice(i, i + maxPerChunk).map(escapeRe);
		// NOTE: we don't add boundaries inside each term; we wrap the whole alternation.
		const alternation = batch.join("|");
		const pat = boundaryWrap(alternation, boundaryMode);
		chunks.push(new RegExp(pat, flags));
	}
	return chunks;
}
import { basenameNoExt, generateReferenceKey, getReferenceCount } from "./shared-utils";

// Simple debounce
const debounce = <F extends (...a: any[]) => void>(fn: F, ms: number): F => {
	let t: number | undefined;
	// @ts-ignore
	return function (this: any, ...args: any[]) {
		clearTimeout(t);
		t = setTimeout(() => fn.apply(this, args), ms) as any;
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
		const providers = plugin.snwAPI?.virtualLinkProviders || [];
		log.info("[ImplicitLinks manager] computePhraseInfo: found providers", providers.length);
		log.info("[ImplicitLinks manager] computePhraseInfo: active file", file.path);
		log.info("[ImplicitLinks manager] plugin.snwAPI:", plugin.snwAPI);
		log.info("[ImplicitLinks manager] plugin.snwAPI?.virtualLinkProviders:", plugin.snwAPI?.virtualLinkProviders);

		const makeLink = (realLink: string, display: string | undefined, pos: any) => ({
			realLink,
			display,
			pos,
		});

		const batches = await Promise.all(
			providers.map(async (p: any) => {
				try {
					const result = await p({ file, cache, makeLink });
					log.info("[ImplicitLinks manager] provider returned", (result || []).length, "links");
					return result || [];
				} catch (e) {
					log.warn("[ImplicitLinks manager] Provider error:", e);
					return [];
				}
			}),
		);

		const links = batches.flat();
		log.info("[ImplicitLinks manager] total links from all providers:", links.length);

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
			const linktext = l.display && l.display.trim() ? l.display : l.realLink.replace(/\.md$/, "");
			// Use the realLink (target) for key generation to match what the virtual provider stores
			const key = generateReferenceKey(plugin, l.realLink, file);
			const count = getReferenceCount(plugin, key);

			// Check if this is a backend keyword (starts with "keyword:")
			const isBackendKeyword = l.realLink?.startsWith("keyword:");
			
			// For backend keywords, use synthetic count of 1 to bypass threshold
			// For native phrases, apply the threshold filter
			const effectiveCount = isBackendKeyword ? 1 : count;
			
			if (!isBackendKeyword && effectiveCount < 1) {
				continue;
			}

			byPhrase.set(linktext.toLowerCase(), {
				target: l.realLink,
				count: effectiveCount,
				key,
			});
		}
	} catch (e) {
		log.warn("[ImplicitLinks manager] Error computing phrase info:", e);
	}

	return byPhrase;
}

// Helper functions now imported from shared-utils.ts

/** Create + manage chunked decorators. Returns a CM6 extension array. */
export function createInferredLinksExtension(
	plugin: any,
	opts?: {
		debounceMs?: number;
		boundaryMode?: "word" | "loose" | "none";
		caseInsensitive?: boolean;
		maxPerChunk?: number;
	},
) {
	const cfg = { debounceMs: 120, boundaryMode: "word" as const, caseInsensitive: true, maxPerChunk: 300, ...(opts || {}) };

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
			maxPerChunk: cfg.maxPerChunk,
		});
		const chunkExts = regexes.map((regex) => makeChunkPlugin(regex, plugin));

		// Reconfigure the compartment with new chunk plugins
		view.dispatch({
			effects: chunksCompartment.reconfigure(chunkExts),
		});
	}, cfg.debounceMs);

	// A tiny ViewPlugin to call runRefresh on edits/viewport changes
	const Driver = ViewPlugin.fromClass(
		class {
			composing = false;
			constructor(readonly view: EditorView) {
				runRefresh(view);
			}
			update(u: ViewUpdate) {
				if (u.docChanged || u.viewportChanged) runRefresh(u.view);

				// Check for implicit links refresh trigger
				const refreshTriggered = u.transactions?.some((tr) => tr.annotation(Transaction.userEvent) === "implicit-links-refresh");
				if (refreshTriggered) {
					runRefresh(u.view);
				}
			}
		},
		{
			eventHandlers: {
				compositionstart() {
					(this as any).composing = true;
				},
				compositionend() {
					(this as any).composing = false;
					runRefresh((this as any).view);
				},
				// Navigation on click (delegate on the mark)
				mousedown(ev, view) {
					const el = (ev.target as HTMLElement)?.closest?.(".snw-implicit-link") as HTMLElement | null;
					if (!el) return;
					ev.preventDefault();
					const toPath = el.getAttribute(ATTR.target) || "";
					const from = plugin?.app?.workspace?.getActiveFile?.()?.path ?? "";
					const dest = plugin?.app?.metadataCache?.getFirstLinkpathDest?.(toPath, from);
					plugin?.app?.workspace?.openLinkText?.(dest?.path ?? toPath, from, false);
				},
				click(ev, view) {
					const badge = (ev.target as HTMLElement)?.closest?.(".snw-implicit-badge");
					if (!badge) return;
					ev.preventDefault();
					// Open your references panel here if desired
				},
			},
		},
	);

	// Return the whole extension: cache field + dynamic chunk compartment + driver
	return [
		inferredCacheField,
		chunksCompartment.of([]), // starts empty; populated after first refresh
		Driver,
	];
}
