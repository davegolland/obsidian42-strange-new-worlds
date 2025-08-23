// Fast guards for contexts where we should NOT add inferred badges
export function isInsideWikiLink(doc: import("@codemirror/state").Text, from: number, to: number): boolean {
	// Scan a small window around the match; tune if needed
	const WINDOW = 256;
	const start = Math.max(0, from - WINDOW);
	const end = Math.min(doc.length, to + WINDOW);
	const slice = doc.sliceString(start, end);
	const relFrom = from - start;
	const relTo = to - start;

	// nearest '[[' before from, nearest ']]' after to
	const openIdx = slice.lastIndexOf("[[", relFrom);
	if (openIdx === -1) return false;

	const closeBefore = slice.lastIndexOf("]]", relFrom);
	if (closeBefore > openIdx) return false; // a ']]' closes after the open → not inside

	const closeIdx = slice.indexOf("]]", relTo);
	if (closeIdx === -1) return false;

	return openIdx < relFrom && relTo <= closeIdx; // inside [[ ... ]]
}

export function isInsideMarkdownLink(doc: import("@codemirror/state").Text, from: number, to: number): boolean {
	// Very light heuristic: [ ... ]( ... ) with our span inside [...]
	const WINDOW = 256;
	const start = Math.max(0, from - WINDOW);
	const end = Math.min(doc.length, to + WINDOW);
	const s = doc.sliceString(start, end);
	const relFrom = from - start;
	const relTo = to - start;

	const lb = s.lastIndexOf("[", relFrom);
	if (lb === -1) return false;
	const rb = s.indexOf("]", relTo);
	if (rb === -1) return false;

	const paren = s.slice(rb, rb + 3);
	return /\]\(/.test(paren); // right after the closing bracket we have a '('
}

export function isInsideCode(doc: import("@codemirror/state").Text, from: number, to: number): boolean {
	// Skip inline code `…` (cheap toggle count in the line)
	const lineStart = doc.lineAt(from).from;
	const lineEnd = doc.lineAt(from).to;
	const line = doc.sliceString(lineStart, lineEnd);
	let ticks = 0;
	for (let i = 0; i < line.length; i++) if (line[i] === "`") ticks++;
	// If there is any inline code on the line, do a tighter check:
	if (ticks % 2 === 0) return false;
	// Basic: treat any backtick pair around our span as "inside code"
	const relFrom = from - lineStart;
	const relTo = to - lineStart;
	const left = line.lastIndexOf("`", relFrom);
	const right = line.indexOf("`", relTo);
	return left !== -1 && right !== -1 && left < relFrom && relTo <= right;
}
