// This module builds on Obsidians cache to provide more specific link information

import { type CachedMetadata, type HeadingCache, type Pos, type TFile, parseLinktext, stripHeading } from "obsidian";
import type SNWPlugin from "./main";
import type { TransformedCache } from "./types";

let plugin: SNWPlugin;

export function setPluginVariableForIndexer(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
}

export function getIndexedReferences() {
	return plugin.referenceCountingPolicy.getIndexedReferences();
}

// Primary Indexing function. Adds to the indexedReferences map all outgoing links from a given file
// The Database is primarily a key which is the link, and the value is an array of references that use that link
export const getLinkReferencesForFile = (file: TFile, cache: CachedMetadata) => {
	plugin.referenceCountingPolicy.getLinkReferencesForFile(file, cache);
};

// removes existing references from the map, used with getLinkReferencesForFile to rebuild the refeences
export const removeLinkReferencesForFile = async (file: TFile) => {
	plugin.referenceCountingPolicy.removeLinkReferencesForFile(file);
};

/**
 * Buildings a optimized list of cache references for resolving the block count.
 * It is only updated when there are data changes to the vault. This is hooked to an event
 * trigger in main.ts
 */
export function buildLinksAndReferences(): void {
	plugin.referenceCountingPolicy.buildLinksAndReferences();
}

// Provides an optimized view of the cache for determining the block count for references in a given page
export function getSNWCacheByFile(file: TFile): TransformedCache {
	return plugin.referenceCountingPolicy.getSNWCacheByFile(file);
}

// Utility to convert a link text to a full path for searching in the indexed references
export function parseLinkTextToFullPath(link: string): string {
	const resolvedFilePath = parseLinktext(link);
	if (resolvedFilePath && resolvedFilePath.path) {
		const tfileDestination = plugin.app.metadataCache.getFirstLinkpathDest(resolvedFilePath.path, "/");
		if (tfileDestination) {
			return tfileDestination.path + (resolvedFilePath.subpath || "");
		}
	}
	return link;
}
