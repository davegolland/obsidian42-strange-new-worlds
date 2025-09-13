import type { CachedMetadata, TFile } from "obsidian";
import type SNWPlugin from "./main";
import type { TransformedCache, VirtualLinkProvider } from "./types";
import type { ReferenceCountingPolicy } from "./policies/reference-counting";

/**
 * Provide a simple API for use with Templater, Dataview and debugging the complexities of various pages.
 * main.ts will attach this to window.snwAPI
 */
export default class SnwAPI {
	plugin: SNWPlugin;
	references: any;


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
		const policy = this.plugin.referenceCountingPolicy as ReferenceCountingPolicy;
		return policy.registerVirtualLinkProvider(provider);
	}


	/**
	 * Get all registered virtual link providers
	 */
	get virtualLinkProviders(): VirtualLinkProvider[] {
		const policy = this.plugin?.referenceCountingPolicy as ReferenceCountingPolicy;
		return policy?.getVirtualLinkProviders() ?? [];
	}

	// (If any UI piece still calls this, give it a safe fallback)
	getSNWCacheByFile(file: TFile): TransformedCache {
		const policy = this.plugin?.referenceCountingPolicy as ReferenceCountingPolicy;
		return policy?.getSNWCacheByFile?.(file) ?? {
			cacheMetaData: null,
			createDate: Date.now(),
		};
	}
}
