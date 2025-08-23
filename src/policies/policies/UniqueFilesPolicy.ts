import type { Link } from "../../types";
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { normalizeBase } from "../linkKeyUtils";

/**
 * Treat each resolved file path as unique (no grouping beyond path).
 */
export class UniqueFilesPolicy extends AbstractWikilinkEquivalencePolicy {
	name = "Unique Files (No Grouping)";
	generateKey(link: Link): string {
		return normalizeBase(link, "preserve");
	}
}
