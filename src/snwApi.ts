import type { CachedMetadata, TFile } from "obsidian";
import type SNWPlugin from "./main";
import type { TransformedCache, TransformedCacheMinimal, VirtualLinkProvider, Link } from "./types";
import type { ReferenceCountingPolicy } from "./policies/reference-counting";

/**
 * Provide a simple API for use with Templater, Dataview and debugging the complexities of various pages.
 */
export default class SnwAPI {
	plugin: SNWPlugin;
	references: Map<string, Link[]>;


	constructor(snwPlugin: SNWPlugin) {
		this.plugin = snwPlugin;
	}


	getMetaInfoByCurrentFile = async (): Promise<{
		TFile: TFile | null;
		metadataCache: CachedMetadata | null;
		SnwTransformedCache: TransformedCache | null;
	} | null> => {
		return this.getMetaInfoByFileName(this.plugin.app.workspace.getActiveFile()?.path || "");
	};


	// For given file name passed into the function, get the meta info for that file
	getMetaInfoByFileName = async (fileName: string) => {
		const currentFile = this.plugin.app.metadataCache.getFirstLinkpathDest(fileName, "/");
		return {
			TFile: currentFile,
			metadataCache: currentFile ? this.plugin.app.metadataCache.getFileCache(currentFile) : null,
			SnwTransformedCache: currentFile ? this.plugin.referenceCountingPolicy.getSNWCacheByFile(currentFile) : null,
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
	getSNWCacheByFile(file: TFile): TransformedCacheMinimal {
		const cache = this.plugin?.referenceCountingPolicy?.getSNWCacheByFile?.(file);
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
