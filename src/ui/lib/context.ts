import type { Span } from "../../backend/types";

/**
 * Build context preview around a span in text
 * @param text The full text content
 * @param span The span to build context around
 * @param radius Number of characters to show before/after the span
 * @returns Object with before, match, and after text segments
 */
export function buildContext(
  text: string,
  span: Span,
  radius = 60
): { before: string; match: string; after: string } {
  const len = text.length;
  const s = Math.max(0, Math.min(len, span.start));
  const e = Math.max(s, Math.min(len, span.end));
  const b0 = Math.max(0, s - radius);
  const a1 = Math.min(len, e + radius);

  const before = (b0 > 0 ? "…" : "") + text.slice(b0, s);
  const match = text.slice(s, e);
  const after = text.slice(e, a1) + (a1 < len ? "…" : "");
  
  return { before, match, after };
}

/**
 * Build a simple context string with HTML highlighting
 * @param text The full text content
 * @param span The span to build context around
 * @param radius Number of characters to show before/after the span
 * @returns HTML string with highlighted match
 */
export function buildContextHTML(
  text: string,
  span: Span,
  radius = 60
): string {
  const ctx = buildContext(text, span, radius);
  return `${ctx.before}<mark class="candidate-highlight">${ctx.match}</mark>${ctx.after}`;
}
