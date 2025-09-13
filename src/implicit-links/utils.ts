import type { Pos } from "obsidian";
import type { TextSpan } from "../types";

/**
 * Convert a text span (start/end offsets) to line/column positions
 */
export function offsetRangeToPos(fullText: string, span: TextSpan): { start: Pos; end: Pos } {
	const lineStarts: number[] = [0];
	for (let i = 0; i < fullText.length; i++) {
		if (fullText[i] === "\n") {
			lineStarts.push(i + 1);
		}
	}

	const toLC = (offset: number): Pos => {
		const line = upperBound(lineStarts, offset) - 1;
		return {
			line,
			col: offset - lineStarts[line],
			offset,
		};
	};

	return {
		start: toLC(span.start),
		end: toLC(span.end),
	};
}

/**
 * Binary search to find the upper bound in a sorted array
 */
function upperBound(arr: number[], target: number): number {
	let lo = 0,
		hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (arr[mid] <= target) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	return lo;
}


/**
 * Return non-code, non-existing-link segments with base offsets into the original text.
 * Keeps the original text intact so offset math remains valid.
 */
export function getCleanSegments(text: string, cache: any): Array<{ text: string; baseOffset: number }> {
	// Simple heuristic version using regex, can be upgraded to use cache.sections precisely
	// Build a mask of excluded ranges (code blocks, inline code, [..](..), [[..]])
	const excludes: Array<{ start: number; end: number }> = [];
	const addAll = (re: RegExp) => {
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) excludes.push({ start: m.index, end: m.index + m[0].length });
	};
	addAll(/```[\s\S]*?```/g);
	addAll(/`[^`]*`/g);
	addAll(/\[[^\]]*\]\([^)]*\)/g);
	addAll(/\[\[[^\]]*\]\]/g);
	excludes.sort((a, b) => a.start - b.start);

	const segments: Array<{ text: string; baseOffset: number }> = [];
	let cursor = 0;
	for (const { start, end } of excludes) {
		if (cursor < start) segments.push({ text: text.slice(cursor, start), baseOffset: cursor });
		cursor = Math.max(cursor, end);
	}
	if (cursor < text.length) segments.push({ text: text.slice(cursor), baseOffset: cursor });
	return segments;
}
