import { LancasterStemmer } from "natural";
import type { Link } from "../../types";
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { getBasenameWithoutExt, normalizeBase } from "../linkKeyUtils";

export class WordFormPolicy extends AbstractWikilinkEquivalencePolicy {
	name = "Word Form Unification";
	generateKey(link: Link): string {
		const base = getBasenameWithoutExt(normalizeBase(link, "preserve")).toLowerCase();
		// very light stem to group simple word forms
		return LancasterStemmer.stem(base);
	}
}
