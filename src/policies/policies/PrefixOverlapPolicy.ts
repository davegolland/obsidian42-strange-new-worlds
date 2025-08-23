import type { Link } from "../../types";
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { getBasenameWithoutExt, normalizeBase } from "../linkKeyUtils";

/**
 * Example policy: group links sharing a basename prefix before punctuation/space.
 * Useful when files use prefixes like "Project - Alpha", "Project - Beta".
 */
export class PrefixOverlapPolicy extends AbstractWikilinkEquivalencePolicy {
	name = "Prefix Overlap";
	generateKey(link: Link): string {
		const base = getBasenameWithoutExt(normalizeBase(link, "preserve")).toUpperCase();
		const m = base.split(/[-–—:·|_ ]/)[0];
		return m || base;
	}
}
