import type { CachedMetadata, TFile } from "obsidian";
import type SNWPlugin from "./main";
import type { TransformedCache, VirtualLinkProvider } from "./types";

/**
 * Provide a simple API for use with Templater, Dataview and debugging the complexities of various pages.
 * main.ts will attach this to window.snwAPI
 */
export default class SnwAPI {
	plugin: SNWPlugin;
	references: any;

	/** Queue for providers if policy isn't ready yet */
	private _queuedProviders: Set<VirtualLinkProvider> | undefined;

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
		const policy = this.plugin?.referenceCountingPolicy as any;

		if (policy && typeof policy.registerVirtualLinkProvider === "function") {
			// Normal, fast path
			return policy.registerVirtualLinkProvider(provider);
		}

		// Fallback: queue providers until policy exists
		if (!this._queuedProviders) this._queuedProviders = new Set();
		this._queuedProviders.add(provider);

		// Return an unregister that removes from the queue
		return () => this._queuedProviders?.delete(provider);
	}

	/**
	 * Called once policy is definitely constructed
	 */
	flushQueuedProviders(): void {
		if (!this._queuedProviders?.size) return;
		const policy = this.plugin?.referenceCountingPolicy as any;
		if (!policy?.registerVirtualLinkProvider) return;

		for (const p of this._queuedProviders) policy.registerVirtualLinkProvider(p);
		this._queuedProviders.clear();
	}

	/**
	 * Get all registered virtual link providers
	 */
	get virtualLinkProviders(): VirtualLinkProvider[] {
		const policy = this.plugin?.referenceCountingPolicy as any;
		if (policy?.getVirtualLinkProviders) return policy.getVirtualLinkProviders();
		return Array.from(this._queuedProviders ?? []);
	}

	// (If any UI piece still calls this, give it a safe fallback)
	getSNWCacheByFile(file: any) {
		const policy = this.plugin?.referenceCountingPolicy as any;
		return policy?.getSNWCacheByFile?.(file) ?? {
			countForKey: () => 0,
			getLinksForKey: () => [],
		};
	}
}
