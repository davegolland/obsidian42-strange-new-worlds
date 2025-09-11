import { log } from "../diag";
import type { CandidatesResponse, StatusResponse, VaultCreate } from "./types";

export class BackendClient {
	private vaultName: string | null = null;
	private vaultPath: string | null = null;

	constructor(private baseUrl: string) {}
	getBaseUrl(): string { return this.baseUrl; }

	async register(vaultName: string, vaultPath: string): Promise<void> {
		const url = `${this.baseUrl}/register`;
		const payload: VaultCreate = { vault: vaultName, path: vaultPath };
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
			
			// Store vault information for later use
			this.vaultName = vaultName;
			this.vaultPath = vaultPath;
		} catch (e) {
			log.error("HTTP error", e);
			throw e;
		}
	}

	// TEMPORARILY DISABLED - Using new candidates endpoint instead
	// async status(): Promise<StatusSummary> {
	// 	const url = `${this.baseUrl}/status`;
	// 	log.debug("HTTP GET", url);
	// 	log.time(`HTTP ${url}`);

	// 	try {
	// 		const r = await fetch(url);
	// 		log.timeEnd(`HTTP ${url}`);
	// 		log.debug("HTTP status", r.status);
	// 		if (!r.ok) throw new Error(`status failed: ${r.status}`);
	// 		const response: StatusResponse = await r.json();
			
	// 		// Convert new API response to legacy format for compatibility
	// 		return {
	// 			ready: response.status === "healthy",
	// 			vaultPath: null, // Not provided in new API
	// 			files: undefined, // Not provided in new API
	// 			apiVersion: undefined, // Not provided in new API
	// 			commit: undefined, // Not provided in new API
	// 		};
	// 	} catch (e) {
	// 		log.error("HTTP error", e);
	// 		throw e;
	// 	}
	// }

	// TEMPORARILY DISABLED - Using new candidates endpoint instead
	// async related(filePath: string, k = 10, includeSpans = false): Promise<LinkCandidateList> {
	// 	const url = `${this.baseUrl}/query/related`;
	// 	const payload = { file: filePath, k, include_spans: includeSpans };
	// 	log.debug("HTTP POST", url, payload);
	// 	log.time(`HTTP ${url}`);

	// 	try {
	// 		const r = await fetch(url, { 
	// 			method: "POST", 
	// 			headers: { "Content-Type": "application/json" }, 
	// 			body: JSON.stringify(payload) 
	// 		});
	// 		log.timeEnd(`HTTP ${url}`);
	// 		log.debug("HTTP status", r.status);
			
	// 		if (r.status === 503) { 
	// 			log.warn("service warming up (503)"); 
	// 			return { items: [] }; 
	// 		}
	// 		if (!r.ok) { 
	// 			log.warn("non-OK response", r.status); 
	// 			return { items: [] }; 
	// 		}
	// 		const data = await r.json();
	// 		log.debug("related response (truncated)", Array.isArray(data?.items) ? `items=${data.items.length}` : data);
	// 		return data;
	// 	} catch (e) {
	// 		log.error("HTTP error", e);
	// 		// Don't show user notifications for every failed request
	// 		// The provider will just return empty results
	// 		return { items: [] };
	// 	}
	// }

	// TEMPORARILY DISABLED - Using new candidates endpoint instead
	// async checkCandidatesAvailable(): Promise<boolean> {
	// 	const url = `${this.baseUrl}/candidates?vault=test&path=test.md`;
	// 	try {
	// 		const r = await fetch(url, { method: "GET" });
	// 		return r.ok; // 200 means available
	// 	} catch {
	// 		return false;
	// 	}
	// }

	/** Get keyword candidates from a specific markdown file using the new API */
	async getKeywordCandidates(vault: string, path: string): Promise<CandidatesResponse> {
		const url = `${this.baseUrl}/candidates?vault=${encodeURIComponent(vault)}&path=${encodeURIComponent(path)}`;
		log.debug("HTTP GET", url, { vault, path });
		log.time(`HTTP ${url}`);

		try {
			const response = await fetch(url);
			log.timeEnd(`HTTP ${url}`);
			log.debug("HTTP status", response.status);

			if (response.status === 503) {
				log.warn("service warming up (503)");
				// Backend "Service not ready" - return empty response
				return {
					vault,
					path,
					keywords: [],
				};
			}

			if (!response.ok) {
				log.warn("non-OK response", response.status);
				throw new Error(`Failed to fetch keyword candidates: ${response.statusText}`);
			}

			const data: CandidatesResponse = await response.json();
			log.debug("keyword candidates response", { count: data?.keywords?.length, vault: data?.vault, path: data?.path });
			return data;
		} catch (e) {
			log.error("HTTP error", e);
			throw e;
		}
	}

	/** Get keyword candidates for a file using the stored vault information */
	async getKeywordCandidatesForFile(relativeFilePath: string): Promise<CandidatesResponse> {
		if (!this.vaultName || !this.vaultPath) {
			console.warn("SNW: getKeywordCandidatesForFile: not registered");
			throw new Error("Vault not registered. Call register() first.");
		}
		
		// ADD: Diagnostic logging to track HTTP requests
		const url = `${this.baseUrl}/candidates?vault=${encodeURIComponent(this.vaultPath)}&path=${encodeURIComponent(relativeFilePath)}`;
		console.log("SNW: GET", url);
		
		// Use the vault path as the vault parameter (as we discovered in testing)
		return this.getKeywordCandidates(this.vaultPath, relativeFilePath);
	}

	// TEMPORARILY DISABLED - Using new candidates endpoint instead
	// async getWikilinkCandidates(params?: {
	// 	page?: number;
	// 	page_size?: number;
	// 	min_score?: number;
	// 	min_count?: number;
	// }): Promise<WikilinkCandidatesResponse> {
	// 	const searchParams = new URLSearchParams();
	// 	if (params?.page) searchParams.set("page", params.page.toString());
	// 	if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
	// 	if (params?.min_score) searchParams.set("min_score", params.min_score.toString());
	// 	if (params?.min_count) searchParams.set("min_count", params.min_count.toString());

	// 	const url = `${this.baseUrl}/candidates${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
	// 	log.debug("HTTP GET", url, { page: params?.page, page_size: params?.page_size, min_score: params?.min_score, min_count: params?.min_count });
	// 	log.time(`HTTP ${url}`);

	// 	try {
	// 		const response = await fetch(url);
	// 		log.timeEnd(`HTTP ${url}`);
	// 		log.debug("HTTP status", response.status);

	// 		if (response.status === 503) {
	// 			log.warn("service warming up (503)");
	// 			// Backend "Service not ready" - return empty response with pagination
	// 			return {
	// 				candidates: [],
	// 				total_candidates: 0,
	// 				fuzzy_resolved: 0,
	// 				resolution_rate: 0,
	// 				page: params?.page || 1,
	// 				page_size: params?.page_size || 50,
	// 				total_pages: 0,
	// 			};
	// 		}

	// 		if (!response.ok) {
	// 			log.warn("non-OK response", response.status);
	// 			throw new Error(`Failed to fetch candidates: ${response.statusText}`);
	// 		}

	// 		const data = await response.json();
	// 		log.debug("candidates response", { count: data?.candidates?.length, total: data?.total_candidates, page: data?.page, total_pages: data?.total_pages });
	// 		return data;
	// 	} catch (e) {
	// 		log.error("HTTP error", e);
	// 		throw e;
	// 	}
	// }
}
