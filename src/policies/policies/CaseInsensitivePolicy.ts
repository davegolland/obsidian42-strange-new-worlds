import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { normalizeBase } from "../linkKeyUtils";
import { Link } from "../../types";

export class CaseInsensitivePolicy extends AbstractWikilinkEquivalencePolicy {
  name = "Case Insensitive";
  generateKey(link: Link): string { return normalizeBase(link); }
}
