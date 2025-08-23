import type { WikilinkEquivalencePolicyType } from "../settings";
import type { WikilinkEquivalencePolicy } from "./base/WikilinkEquivalencePolicy";

const registry = new Map<string, WikilinkEquivalencePolicy>();

export function _registerPolicy(id: string, impl: WikilinkEquivalencePolicy) {
	registry.set(id, impl);
}

export function getPolicyByType(id: WikilinkEquivalencePolicyType): WikilinkEquivalencePolicy {
	const p = registry.get(id);
	if (!p) {
		// Fallback: prefer case-insensitive if present; else first policy
		const fallback = registry.get("case-insensitive") ?? [...registry.values()][0];
		if (!fallback) throw new Error("No policies registered");
		return fallback;
	}
	return p;
}

export function getPolicyOptions(): Array<{ value: string; name: string }> {
	return [...registry.entries()].map(([value, p]) => ({ value, name: p.name }));
}

// For debugging / testing if useful
export function _getAllPoliciesForDebug(): ReadonlyMap<string, WikilinkEquivalencePolicy> {
	return registry;
}
