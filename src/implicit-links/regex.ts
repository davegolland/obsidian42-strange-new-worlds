export type PhraseRegexOpts = {
  caseInsensitive?: boolean;         // default true
  boundaryMode?: "word" | "loose" | "none"; // default "word"
  maxPerChunk?: number;               // default 300
};

const ESC = /[.*+?^${}()|[\]\\]/g;
const escapeRe = (s: string) => s.replace(ESC, "\\$&");

// naive normalize that mirrors your "cache key" normalization
export const norm = (s: string) => s.trim().toLowerCase();

function boundaryWrap(pattern: string, mode: PhraseRegexOpts["boundaryMode"]) {
  if (mode === "none") return pattern;
  // Unicode-aware "word" boundaries: letters on either side break the match.
  // Requires the /u flag and modern Chromium (Obsidian is fine).
  const left  = mode === "word"  ? "(?<!\\p{L})" : "(?<=^|\\s|[\\p{P}])";
  const right = mode === "word"  ? "(?!\\p{L})"  : "(?=$|\\s|[\\p{P}])";
  return `${left}(?:${pattern})${right}`;
}

/** Build 1..N regex chunks that match ANY of the phrases. */
export function buildPhraseRegexChunks(
  phrases: string[],
  opts: PhraseRegexOpts = {}
): RegExp[] {
  const {
    caseInsensitive = true,
    boundaryMode = "word",
    maxPerChunk = 300,
  } = opts;

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
