import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { normalizeBase } from "../linkKeyUtils";
import { Link } from "../../types";

export class CaseSensitivePolicy extends AbstractWikilinkEquivalencePolicy {
  name = "Case Sensitive";
  generateKey(link: Link): string { return normalizeBase(link, "preserve"); }
}
