import type { CachedMetadata, TFile } from "obsidian";
import type InferredWikilinksPlugin from "./main";
import type { TransformedCache, TransformedCacheMinimal, VirtualLinkProvider, Link } from "./types";
import type { ReferenceCountingPolicy } from "./policies/reference-counting";

/**
 * Provide a simple API for use with Templater, Dataview and debugging the complexities of various pages.
 */
export default class InferredWikilinksAPI {
	plugin: InferredWikilinksPlugin;
	references: Map<string, Link[]>;


	constructor(inferredWikilinksPlugin: InferredWikilinksPlugin) {
		this.plugin = inferredWikilinksPlugin;
	}


	getMetaInfoByCurrentFile = async (): Promise<{
		TFile: TFile | null;
		metadataCache: CachedMetadata | null;
		InferredWikilinksTransformedCache: TransformedCache | null;
	} | null> => {
		return this.getMetaInfoByFileName(this.plugin.app.workspace.getActiveFile()?.path || "");
	};


	// For given file name passed into the function, get the meta info for that file
	getMetaInfoByFileName = async (fileName: string) => {
		const currentFile = this.plugin.app.metadataCache.getFirstLinkpathDest(fileName, "/");
		return {
			TFile: currentFile,
			metadataCache: currentFile ? this.plugin.app.metadataCache.getFileCache(currentFile) : null,
			InferredWikilinksTransformedCache: currentFile ? this.plugin.referenceCountingPolicy.getInferredWikilinksCacheByFile(currentFile) : null,
		};
	};

	parseLinkTextToFullPath(linkText: string) {
		return this.plugin.referenceCountingPolicy.parseLinkTextToFullPath(linkText);
	}

	/**
	 * Register a Virtual Link Provider.
	 * Returns an unregister function; call it to remove the provider.
	 */
	registerVirtualLinkProvider(provider: VirtualLinkProvider): () => void {
		return this.plugin.referenceCountingPolicy.registerVirtualLinkProvider(provider);
	}


	/**
	 * Get all registered virtual link providers
	 */
	get virtualLinkProviders(): VirtualLinkProvider[] {
		return this.plugin?.referenceCountingPolicy?.getVirtualLinkProviders() ?? [];
	}

	// (If any UI piece still calls this, give it a safe fallback)
	getInferredWikilinksCacheByFile(file: TFile): TransformedCacheMinimal {
		const cache = this.plugin?.referenceCountingPolicy?.getInferredWikilinksCacheByFile?.(file);
		return {
			blocks: cache?.blocks ?? [],
			links: cache?.links ?? [],
			headings: cache?.headings ?? [],
			embeds: cache?.embeds ?? [],
			frontmatterLinks: cache?.frontmatterLinks ?? [],
			createDate: cache?.createDate ?? Date.now(),
			cacheMetaData: cache?.cacheMetaData ?? null,
		};
	}
}
