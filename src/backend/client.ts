import type { LinkCandidateList, StatusSummary, WikilinkCandidatesResponse } from "./types";

export class BackendClient {
  constructor(private baseUrl: string) {}

  async register(vaultPath: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vault_path: vaultPath }),
    });
    // backend may answer 202 Accepted and suggest polling /status
    if (![200, 202].includes(r.status)) throw new Error(`register failed: ${r.status}`);
  }

  async status(): Promise<StatusSummary> {
    const r = await fetch(`${this.baseUrl}/status`);
    if (!r.ok) throw new Error(`status failed: ${r.status}`);
    return r.json();
  }

  /** retry on 503 (warming up). no throw; returns [] to avoid UI stalls. */
  async related(filePath: string, k = 10): Promise<LinkCandidateList> {
    const r = await fetch(`${this.baseUrl}/query/related`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: filePath, k }),
    });
    if (r.status === 503) return { items: [] }; // backend "Service not ready"
    if (!r.ok) return { items: [] };
    return r.json();
  }

  /** Get wikilink candidates detected by the backend */
  async getWikilinkCandidates(): Promise<WikilinkCandidatesResponse> {
    const r = await fetch(`${this.baseUrl}/candidates`);
    if (r.status === 503) return { candidates: [], total_candidates: 0, fuzzy_resolved: 0, resolution_rate: 0 }; // backend "Service not ready"
    if (!r.ok) return { candidates: [], total_candidates: 0, fuzzy_resolved: 0, resolution_rate: 0 };
    return r.json();
  }
}
