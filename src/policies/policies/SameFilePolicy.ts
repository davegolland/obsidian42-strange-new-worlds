import type { Link } from "../../types";
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { normalizeBase } from "../linkKeyUtils";

export class SameFilePolicy extends AbstractWikilinkEquivalencePolicy {
	name = "Same File Unification";
	generateKey(link: Link): string {
		const target = normalizeBase(link); // normalized target
		const source = link.sourceFile?.path?.toUpperCase() ?? "UNKNOWN";
		return `${source}:${target}`;
	}
}
