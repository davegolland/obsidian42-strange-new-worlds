import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import { getBasenameWithoutExt, normalizeBase } from "../linkKeyUtils";
import { Link } from "../../types";

export class BaseNamePolicy extends AbstractWikilinkEquivalencePolicy {
  name = "Base Name Only";
  generateKey(link: Link): string {
    // Use normalized base to resolve path or raw, then strip to basename without ext
    const base = normalizeBase(link, "preserve");
    return getBasenameWithoutExt(base).toUpperCase();
  }
}
