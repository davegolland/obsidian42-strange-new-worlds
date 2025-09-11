export type LinkCandidate = { 
  path: string; 
  reason?: string; 
  score?: number;
  span?: Span;  // Character offset span from backend
};
export type LinkCandidateList = { items: LinkCandidate[] };

// Match actual backend models - char-only format
export type Span = {
  start: number;
  end: number;
  unit?: "char";  // Optional, defaults to char
};

// For WLX candidates view - enhanced version with spans and file information
export type WikilinkCandidate = {
	text: string; // phrase
	score: number;
	count: number;
	total: number;
	fuzzy_resolution?: string;
	// Enhanced fields for future backend support
	files?: string[]; // files containing the phrase
	spansByFile?: Record<string, Span[]>; // spans per file
};

// Enhanced response with pagination
export type WikilinkCandidatesResponse = {
	candidates: WikilinkCandidate[];
	total_candidates: number;
	fuzzy_resolved: number;
	resolution_rate: number;
	// Pagination fields
	page: number;
	page_size: number;
	total_pages: number;
	// Optional debug information
	effective_params?: Record<string, unknown>;
	debug_counters?: Record<string, unknown>;
};

export type StatusSummary = {
	ready: boolean;
	vaultPath: string | null;
	files?: number;
	apiVersion?: string;
	commit?: string;
};

// New types for OpenAPI spec compliance
export type VaultCreate = {
	vault: string;
	path: string;
};

export type APISpan = {
	start: number;
	end: number;
};

export type KeywordResponse = {
	keyword: string;
	spans: APISpan[];
};

export type CandidatesResponse = {
	vault: string;
	path: string;
	keywords: KeywordResponse[];
};

export type StatusResponse = {
	status: "healthy" | "unhealthy" | "degraded";
};

export type ErrorResponse = {
	detail: string;
	error_code?: string | null;
	timestamp?: string | null;
};
