import type { CachedMetadata, ListItemCache, Pos, TFile } from "obsidian";
import type SnwAPI from "./snwApi";


declare module "obsidian" {
	interface Workspace {}

	interface MetadataCache {
		metadataCache: {
			[x: string]: CachedMetadata;
		};
		isUserIgnored(path: string): boolean;
	}

	interface Vault {
		fileMap: {
			[x: string]: TFile;
		};
	}
}


export interface Link {
	reference: {
		link: string;
		key: string;
		displayText: string;
		position: Pos;
	};
	resolvedFile: TFile | null;
	realLink: string; //the real link in the markdown
	sourceFile: TFile | null;
}

export interface TransformedCachedItem {
	key: string;
	pos: Pos;
	page: string;
	type: string;
	references: Link[];
	original?: string;
	headerMatch?: string; //used for matching headers
	displayText?: string;
}

export interface TransformedCache {
	blocks?: TransformedCachedItem[];
	links?: TransformedCachedItem[];
	headings?: TransformedCachedItem[];
	embeds?: TransformedCachedItem[];
	frontmatterLinks?: TransformedCachedItem[];
	createDate?: number; //date when cache was generated with Date.now()
	cacheMetaData?: CachedMetadata;
}

// Minimal mode version with required arrays
export interface TransformedCacheMinimal {
	blocks: TransformedCachedItem[];
	links: TransformedCachedItem[];
	headings: TransformedCachedItem[];
	embeds: TransformedCachedItem[];
	frontmatterLinks: TransformedCachedItem[];
	createDate: number;
	cacheMetaData: CachedMetadata | null;
}


/**
 * Providers can return additional virtual links (e.g., Dataview, properties, computed relationships)
 * for a given file+cache. Returned links will be indexed just like regular wikilinks.
 */
export type VirtualLinkProvider = (args: {
	file: TFile;
	cache: CachedMetadata;
	/**
	 * Helper to build a Link object from a link text (e.g., 'Note A#Section' or 'Folder/Note A').
	 * Use this to avoid constructing Link by hand.
	 */
	makeLink: (linkText: string, displayText?: string, pos?: Pos) => Link;
	/**
	 * Obsidian app instance for reading file content and other operations
	 */
	app?: any;
}) => Link[] | Promise<Link[]>;

// Implicit Links Types
export type TextSpan = { start: number; end: number };

export type DetectedLink = {
	span: TextSpan;
	display: string;
	targetPath: string;
	source: "regex" | "dictionary";
};

/**
 * Interface for custom implicit link detectors.
 *
 * Detectors analyze text content to find potential links that should be created
 * as virtual links in the SNW sidebar.
 */
export interface ImplicitLinkDetector {
	/**
	 * Unique identifier for this detector (e.g., "regex", "dictionary", "custom")
	 */
	name: string;

	/**
	 * Analyze text content to detect potential links.
	 *
	 * @param file - The Obsidian file being analyzed
	 * @param text - The raw text content of the file (excluding code blocks and existing links)
	 * @returns Promise resolving to array of detected links
	 *
	 * The text parameter contains the file's content that should be scanned for patterns.
	 * This text has already been preprocessed to exclude:
	 * - Code blocks (```...```)
	 * - Inline code (`...`)
	 * - Existing wikilinks ([[...]])
	 * - Markdown links ([...](...))
	 *
	 * Your detector should scan this clean text for patterns and return any matches
	 * that should become virtual links.
	 */
	detect(file: TFile, text: string): Promise<DetectedLink[]>;
}
