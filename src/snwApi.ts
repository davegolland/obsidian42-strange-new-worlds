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

	constructor(snwPlugin: SNWPlugin) {
		this.plugin = snwPlugin;
	}

	console = (logDescription: string, ...outputs: unknown[]): void => {
		console.log(`SNW: ${logDescription}`, outputs);
	};

	getMetaInfoByCurrentFile = async (): Promise<{
		TFile: TFile | null;
		metadataCache: CachedMetadata | null;
		SnwTransformedCache: TransformedCache | null;
	} | null> => {
		return this.getMetaInfoByFileName(this.plugin.app.workspace.getActiveFile()?.path || "");
	};

	/**
	 * Search for references based on provided criteria
	 * @param options Search options object
	 * @param options.startsWith Search for keys starting with this string
	 * @param options.contains Search for keys containing this string
	 */
	searchReferences = async (options: { startsWith?: string; contains?: string }) => {
		if (!options.startsWith && !options.contains) {
			console.warn("SNW: searchReferences called without any search criteria");
			return;
		}

		const results: [string, unknown][] = [];

		for (const [key, value] of this.plugin.referenceCountingPolicy.getIndexedReferences()) {
			if (options.startsWith && key.startsWith(options.startsWith)) {
				results.push([key, value]);
			} else if (options.contains && key.contains(options.contains)) {
				results.push([key, value]);
			}
		}

		results.forEach(([key, value]) => {
			console.log(key, value);
		});

		return results;
	};

	/**
	 * @deprecated Use searchReferences({ startsWith: searchString }) instead
	 */
	searchReferencesStartingWith = async (searchString: string) => {
		return this.searchReferences({ startsWith: searchString });
	};

	/**
	 * @deprecated Use searchReferences({ contains: searchString }) instead
	 */
	searchReferencesContains = async (searchString: string) => {
		return this.searchReferences({ contains: searchString });
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
}
