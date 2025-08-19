import type { App, TFile, CachedMetadata } from "obsidian";
import type { DetectedLink, ImplicitLinkDetector, TextSpan } from "../types";
import type { AutoLinkSettings } from "../settings";
import type { WikilinkEquivalencePolicy } from "../policies/base/WikilinkEquivalencePolicy";

// Target entry
type Target = { path: string; display: string };

// Trie (character-based)
class TrieNode {
	next: Map<string, TrieNode> = new Map();
	// When a full phrase ends here, we store the canonical key for lookup
	key?: string;
}

export class DictionaryDetector implements ImplicitLinkDetector {
	name = "dictionary";

	private built = false;
	private trieRoot = new TrieNode();
	private keyToTarget = new Map<string, Target>();
	private fold = (s: string) => s.toUpperCase(); // or policy-provided fold if available

	constructor(
		private app: App,
		private settings: AutoLinkSettings,
		private policy: WikilinkEquivalencePolicy,
	) {}

	// Public API
	async detect(file: TFile, text: string): Promise<DetectedLink[]> {
		// Lazy build (you can also call build() during plugin init)
		if (!this.built) await this.build();

		// Strip code blocks / inline code / existing links if you have helpers.
		// For now we scan the whole text. TODO: replace with your "clean segments" helper.
		const matches = this.scan(text);

		// Map matches to DetectedLink with resolved paths & display
		const results: DetectedLink[] = [];
		for (const m of matches) {
			const target = this.keyToTarget.get(m.key);
			if (!target) continue;
			const display = text.slice(m.span.start, m.span.end);
			results.push({
				span: m.span,
				display,
				targetPath: target.path,
				source: "dictionary",
			});
		}
		return this.resolveOverlaps(results);
	}

	// ---- Build dictionary & trie ----
	private async build() {
		this.trieRoot = new TrieNode();
		this.keyToTarget.clear();

		const mdFiles = this.app.vault.getMarkdownFiles();

		// Collect source names
		const names: string[] = [];

		// Add file-based names
		for (const f of mdFiles) {
			const cache = this.app.metadataCache.getFileCache(f);
			if (!cache) continue;

			if (this.settings.dictionary?.sources.basenames) {
				names.push(f.basename);
			}
			if (this.settings.dictionary?.sources.aliases) {
				const aliases = cache.frontmatter?.aliases;
				if (Array.isArray(aliases)) {
					for (const a of aliases) if (typeof a === "string") names.push(a);
				}
			}
			if (this.settings.dictionary?.sources.headings) {
				const headings = cache.headings;
				if (Array.isArray(headings)) {
					for (const h of headings) if (h?.heading) names.push(h.heading);
				}
			}
		}

		// ✅ FIX: include custom phrases from settings
		if (this.settings.dictionary?.sources.customList) {
			const list = this.settings.dictionary.customPhrases || [];
			for (const raw of list) {
				if (typeof raw !== "string") continue;
				const phrase = raw.trim();
				if (!phrase) continue;
				names.push(phrase);
			}
		}

		// Create targets + insert into map & trie using the SAME fold as scan:
		for (const name of names) {
			const trimmed = name.trim();
			if (!trimmed) continue;
			if ((this.settings.dictionary?.minPhraseLength ?? 3) > trimmed.length) continue;

			// Policy normalization → canonical key
			const key = this.policy.generateKey!({ 
				realLink: trimmed,
				reference: { link: trimmed, key: trimmed, displayText: trimmed, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } },
				resolvedFile: null,
				sourceFile: null
			});
			
			// For custom phrases, create a default target if none exists
			if (!this.keyToTarget.has(key)) {
				// Try to find a matching file first
				const dest = this.app.metadataCache.getFirstLinkpathDest(trimmed, "");
				const target = dest ? { path: dest.path, display: trimmed } : { path: `${trimmed}.md`, display: trimmed };
				this.keyToTarget.set(key, target);
				this.insertIntoTrie(trimmed, key);
			}
		}

		this.built = true;

		// OPTIONAL: subscribe to vault events for incremental rebuilds (debounce)
		// this.registerEvent(this.app.vault.on("create", ...))
		// this.registerEvent(this.app.vault.on("rename", ...))
		// this.registerEvent(this.app.metadataCache.on("changed", ...))
	}

	private insertIntoTrie(phrase: string, key: string) {
		const folded = this.fold(phrase);
		let node = this.trieRoot;
		for (const ch of folded) {
			let next = node.next.get(ch);
			if (!next) {
				next = new TrieNode();
				node.next.set(ch, next);
			}
			node = next;
		}
		node.key = key; // store canonical key at terminal node
	}

	// ---- Scanning ----
	private scan(text: string): Array<{ span: TextSpan; key: string }> {
		const out: Array<{ span: TextSpan; key: string }> = [];
		const n = text.length;
		const requireWB = !!this.settings.dictionary?.requireWordBoundaries;
		const foldedText = this.fold(text); // preserves indices

		let i = 0;
		while (i < n) {
			let node = this.trieRoot, j = i, lastKey: string | null = null, lastEnd = i;
			while (j < n) {
				const next = node.next.get(foldedText[j]);
				if (!next) break;
				node = next; j++;
				if (node.key) { lastKey = node.key; lastEnd = j; }
			}
			if (lastKey && lastEnd > i) {
				const wbOK = !requireWB || (isBoundary(foldedText, i - 1) && isBoundary(foldedText, lastEnd));
				if (wbOK) { out.push({ span: { start: i, end: lastEnd }, key: lastKey }); i = lastEnd; continue; }
			}
			i++;
		}
		return out;
	}

	private resolveOverlaps(items: DetectedLink[]): DetectedLink[] {
		// Minimal rule: "longest span wins", then earlier start
		items.sort((a, b) => {
			const la = a.span.end - a.span.start;
			const lb = b.span.end - b.span.start;
			if (la !== lb) return lb - la;
			return a.span.start - b.span.start;
		});
		const picked: DetectedLink[] = [];
		let lastEnd = -1;
		for (const it of items) {
			if (it.span.start >= lastEnd) {
				picked.push(it);
				lastEnd = it.span.end;
			}
		}
		return picked;
	}
}

// Helpers
function isBoundary(text: string, idx: number): boolean {
	// "Boundary" at text[-1] and text[n] as well
	if (idx < 0 || idx >= text.length) return true;
	const ch = text[idx];
	return !isWordChar(ch);
}

function isWordChar(ch: string): boolean {
	// You can refine this (unicode categories). For now: letters, digits, underscore.
	return /[A-Za-z0-9_]/.test(ch);
}
