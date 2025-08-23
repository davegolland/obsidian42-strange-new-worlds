import type { Link } from "../../types";

/**
 * Contract for wikilink equivalence policies.
 * Some policies may need async I/O (e.g., external service); they can opt-in via isAsync().
 */
export interface WikilinkEquivalencePolicy {
	/** Display name of the policy (for UI). */
	name: string;
	/** True if generateKeyAsync() will be used. */
	isAsync?(): boolean;
	/** Synchronous key generation (default). */
	generateKey?(link: Link): string;
	/** Async key generation (optional). */
	generateKeyAsync?(link: Link): Promise<string>;
	/** Count references (override to customize). */
	countReferences?(references: Link[] | undefined): number;
	/** Filter references (override to customize). */
	filterReferences?(references: Link[] | undefined): Link[];
}

export abstract class AbstractWikilinkEquivalencePolicy implements WikilinkEquivalencePolicy {
	abstract name: string;
	isAsync(): boolean {
		return false;
	}
	countReferences(references: Link[] | undefined): number {
		return references ? references.length : 0;
	}
	filterReferences(references: Link[] | undefined): Link[] {
		return references || [];
	}
	abstract generateKey(link: Link): string;
}
