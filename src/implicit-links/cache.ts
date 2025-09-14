import { StateEffect, StateField } from "@codemirror/state";

export type PhraseInfo = { target: string; count: number; key: string; badgeText?: string };
export type InferredCache = {
	// For decoration lookups
	byPhrase: Map<string, PhraseInfo>; // key = normalized phrase
	// To know when the regex must be rebuilt
	phrasesVersion: number; // bump when the PHRASE SET changes
	// Optional: for display/telemetry
	totalPhrases: number;
};

export const setInferredCache = StateEffect.define<InferredCache>();

export const inferredCacheField = StateField.define<InferredCache>({
	create() {
		return { byPhrase: new Map(), phrasesVersion: 0, totalPhrases: 0 };
	},
	update(value, tr) {
		for (const e of tr.effects) if (e.is(setInferredCache)) return e.value;
		return value;
	},
});
