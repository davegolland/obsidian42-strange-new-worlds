// New API types based on OpenAPI spec

// Legacy types for backward compatibility (temporarily disabled)
export type LinkCandidate = { 
  path: string; 
  reason?: string; 
  score?: number;
  span?: APISpan;  // Character offset span from backend
  text?: string;   // For virtual links
  target?: string; // For virtual links
  count?: number;  // For virtual links
  spans?: APISpan[]; // Multiple spans for keywords
};
export type LinkCandidateList = { items: LinkCandidate[] };

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

// References API types
export type Reference = {
	file: string;
	title: string;
	snippet: string;
	line: number;
	col: number;
};

export type ReferencesResponse = {
	linkId: string;
	references: Reference[];
	total: number;
};
