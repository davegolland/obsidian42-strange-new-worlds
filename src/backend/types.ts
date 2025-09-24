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

// New types for OpenAPI spec compliance
export type VaultCreate = {
	vault: string;
	path: string;
};

export type APISpan = {
	start: number;
	end: number;
};

export type Breadcrumbs = {
	headings: string[];
	list: string[];
};

export type BlockInfo = {
	kind: "list" | "section";
	start_offset: number;
	end_offset: number;
	markdown: string;
	block_html?: string | null;
};

export type KeywordResponse = {
	keyword: string;
	spans: APISpan[];
	badge?: string;
};

export type CandidatesResponse = {
	vault: string;
	path: string;
	keywords: KeywordResponse[];
};

export type StatusResponse = {
	status: "healthy" | "unhealthy" | "degraded";
	capabilities?: string[];
};


// References API types
export type ReferenceItem = {
	file: string;
	title?: string | null;
	snippet: string;
	line: number;
	col: number;
	breadcrumbs?: Breadcrumbs | null;
	block?: BlockInfo | null;
	highlights?: Array<[number, number]> | null;
	preview_one_line?: string | null;
	block_html?: string | null;
};

export type ReferencesResponse = {
	link_type: "keyword";
	term: string;
	references: ReferenceItem[];
	total: number;
	next_offset?: number | null;
};
