export type LinkCandidate = { path: string; reason?: string; score?: number };
export type LinkCandidateList = { items: LinkCandidate[] };

export type WikilinkCandidate = {
  text: string;
  score: number;
  count: number;
  total: number;
  fuzzy_resolution?: string;
};

export type WikilinkCandidatesResponse = {
  candidates: WikilinkCandidate[];
  total_candidates: number;
  fuzzy_resolved: number;
  resolution_rate: number;
};

export type StatusSummary = {
  ready: boolean;
  vaultPath: string | null;
  files?: number;
  apiVersion?: string;
  commit?: string;
};
