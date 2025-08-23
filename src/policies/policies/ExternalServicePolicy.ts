import type { Link } from "../../types";
import type { WikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";

/**
 * Service-backed policy that POSTs a link payload to an external endpoint
 * and receives a canonical key. This is a stub: wire it to your backend.
 */
export class ExternalServicePolicy implements WikilinkEquivalencePolicy {
	name = "External Service (Stub)";
	private endpoint: string;
	private apiKey?: string;
	constructor(opts: { endpoint: string; apiKey?: string }) {
		this.endpoint = opts.endpoint;
		this.apiKey = opts.apiKey;
	}
	isAsync(): boolean {
		return true;
	}
	async generateKeyAsync(link: Link): Promise<string> {
		// Minimal payload—extend to your needs (include vault hints, aliases, etc.)
		const payload = {
			sourcePath: link.sourceFile?.path ?? "",
			targetPath: link.resolvedFile?.path ?? null,
			raw: link.reference?.link ?? link.realLink,
			subpath: link.reference?.subpath ?? null,
		};
		try {
			const res = await fetch(this.endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
				},
				body: JSON.stringify(payload),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const { key } = await res.json();
			if (typeof key !== "string" || !key.length) throw new Error("Bad key");
			return key;
		} catch (e) {
			console.warn("[SNW] ExternalServicePolicy failed, falling back to raw key:", e);
			// Safe fallback so the UI still renders
			return (payload.targetPath ?? payload.raw).toUpperCase();
		}
	}
	countReferences(references: Link[] | undefined): number {
		return references ? references.length : 0;
	}
	filterReferences(references: Link[] | undefined): Link[] {
		return references || [];
	}
}
