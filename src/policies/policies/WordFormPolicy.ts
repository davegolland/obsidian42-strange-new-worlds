import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { Link } from "../../types";
import { LancasterStemmer } from "natural";
import { normalizeBase, getBasenameWithoutExt } from "../linkKeyUtils";

export class WordFormPolicy extends AbstractWikilinkEquivalencePolicy {
  name = "Word Form Unification";
  generateKey(link: Link): string {
    const base = getBasenameWithoutExt(normalizeBase(link, "preserve")).toLowerCase();
    // very light stem to group simple word forms
    return LancasterStemmer.stem(base);
  }
}
