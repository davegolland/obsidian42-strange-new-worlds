import { log } from "../diag";
import type { LinkCandidateList, StatusSummary, WikilinkCandidatesResponse } from "./types";

export class BackendClient {
	constructor(private baseUrl: string) {}

	async register(vaultPath: string): Promise<void> {
		const url = `${this.baseUrl}/register`;
		const payload = { vault_path: vaultPath };
		log.debug("HTTP POST", url, payload);
		log.time(`HTTP ${url}`);

		try {
			const r = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			log.timeEnd(`HTTP ${url}`);
			log.debug("HTTP status", r.status);
			// backend may answer 202 Accepted and suggest polling /status
			if (![200, 202].includes(r.status)) throw new Error(`register failed: ${r.status}`);
		} catch (e) {
			log.error("HTTP error", e);
			throw e;
		}
	}

	async status(): Promise<StatusSummary> {
		const url = `${this.baseUrl}/status`;
		log.debug("HTTP GET", url);
		log.time(`HTTP ${url}`);

		try {
			const r = await fetch(url);
			log.timeEnd(`HTTP ${url}`);
			log.debug("HTTP status", r.status);
			if (!r.ok) throw new Error(`status failed: ${r.status}`);
			return r.json();
		} catch (e) {
			log.error("HTTP error", e);
			throw e;
		}
	}

	/** retry on 503 (warming up). no throw; returns [] to avoid UI stalls. */
	async related(filePath: string, k = 10, includeSpans = false): Promise<LinkCandidateList> {
		const url = `${this.baseUrl}/query/related`;
		const payload = { file: filePath, k, include_spans: includeSpans };
		log.debug("HTTP POST", url, payload);
		log.time(`HTTP ${url}`);

		try {
			const r = await fetch(url, { 
				method: "POST", 
				headers: { "Content-Type": "application/json" }, 
				body: JSON.stringify(payload) 
			});
			log.timeEnd(`HTTP ${url}`);
			log.debug("HTTP status", r.status);
			
			if (r.status === 503) { 
				log.warn("service warming up (503)"); 
				return { items: [] }; 
			}
			if (!r.ok) { 
				log.warn("non-OK response", r.status); 
				return { items: [] }; 
			}
			const data = await r.json();
			log.debug("related response (truncated)", Array.isArray(data?.items) ? `items=${data.items.length}` : data);
			return data;
		} catch (e) {
			log.error("HTTP error", e);
			// Don't show user notifications for every failed request
			// The provider will just return empty results
			return { items: [] };
		}
	}

	/** Get wikilink candidates detected by the backend with pagination support */
	async getWikilinkCandidates(params?: {
		page?: number;
		page_size?: number;
		min_score?: number;
		min_count?: number;
	}): Promise<WikilinkCandidatesResponse> {
		const searchParams = new URLSearchParams();
		if (params?.page) searchParams.set("page", params.page.toString());
		if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
		if (params?.min_score) searchParams.set("min_score", params.min_score.toString());
		if (params?.min_count) searchParams.set("min_count", params.min_count.toString());

		const url = `${this.baseUrl}/candidates${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
		log.debug("HTTP GET", url, { page: params?.page, page_size: params?.page_size, min_score: params?.min_score, min_count: params?.min_count });
		log.time(`HTTP ${url}`);

		try {
			const response = await fetch(url);
			log.timeEnd(`HTTP ${url}`);
			log.debug("HTTP status", response.status);

			if (response.status === 503) {
				log.warn("service warming up (503)");
				// Backend "Service not ready" - return empty response with pagination
				return {
					candidates: [],
					total_candidates: 0,
					fuzzy_resolved: 0,
					resolution_rate: 0,
					page: params?.page || 1,
					page_size: params?.page_size || 50,
					total_pages: 0,
				};
			}

			if (!response.ok) {
				log.warn("non-OK response", response.status);
				throw new Error(`Failed to fetch candidates: ${response.statusText}`);
			}

			const data = await response.json();
			log.debug("candidates response", { count: data?.candidates?.length, total: data?.total_candidates, page: data?.page, total_pages: data?.total_pages });
			return data;
		} catch (e) {
			log.error("HTTP error", e);
			throw e;
		}
	}
}
