import type { Link } from "../../types";
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { normalizeBase } from "../linkKeyUtils";

export class CaseInsensitivePolicy extends AbstractWikilinkEquivalencePolicy {
	name = "Case Insensitive";
	generateKey(link: Link): string {
		return normalizeBase(link);
	}
}
