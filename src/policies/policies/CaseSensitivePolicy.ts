import type { Link } from "../../types";
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { normalizeBase } from "../linkKeyUtils";

export class CaseSensitivePolicy extends AbstractWikilinkEquivalencePolicy {
	name = "Case Sensitive";
	generateKey(link: Link): string {
		return normalizeBase(link, "preserve");
	}
}
