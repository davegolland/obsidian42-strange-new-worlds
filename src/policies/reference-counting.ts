import type { Link, TransformedCache } from "../types";
import type SNWPlugin from "../main";
import { stripHeading, type TFile, parseLinktext } from "obsidian";

export class ReferenceCountingPolicy {
    private plugin: SNWPlugin;
    private cacheCurrentPages: Map<string, TransformedCache>;
    private lastUpdateToReferences: number;
    private indexedReferences: Map<string, Link[]>;

    constructor(plugin: SNWPlugin) {
        this.plugin = plugin;
        this.cacheCurrentPages = new Map<string, TransformedCache>();
        this.lastUpdateToReferences = 0;
        this.indexedReferences = new Map();
    }

    /**
     * Utility to convert a link text to a full path for searching in the indexed references
     * @param link The link text to convert
     * @returns The full path
     */
    parseLinkTextToFullPath(link: string): string {
        const resolvedFilePath = parseLinktext(link);
        if (resolvedFilePath && resolvedFilePath.path) {
            const tfileDestination = this.plugin.app.metadataCache.getFirstLinkpathDest(resolvedFilePath.path, "/");
            if (tfileDestination) {
                return tfileDestination.path + (resolvedFilePath.subpath || "");
            }
        }
        return link;
    }

    /**
     * Get the indexed references map
     * @returns The map of indexed references
     */
    getIndexedReferences(): Map<string, Link[]> {
        return this.indexedReferences;
    }

    /**
     * Set the plugin variable for the policy
     * @param snwPlugin The SNWPlugin instance
     */
    setPluginVariable(snwPlugin: SNWPlugin): void {
        this.plugin = snwPlugin;
    }

    /**
     * Get the last update timestamp for references
     * @returns The timestamp of the last update
     */
    getLastUpdateToReferences(): number {
        return this.lastUpdateToReferences;
    }

    /**
     * Counts references based on the current settings
     * @param references Array of Link objects to count
     * @returns The number of references according to the current policy
     */
    countReferences(references: Link[] | undefined): number {
        if (!references) return 0;

        if (this.plugin.settings.countUniqueFilesOnly) {
            const uniqueSourceFiles = new Set(references.map(link => link.sourceFile?.path).filter(Boolean));
            return uniqueSourceFiles.size;
        }

        return references.length;
    }

    /**
     * Filters references based on the current settings
     * @param references Array of Link objects to filter
     * @returns Filtered array of references according to the current policy
     */
    filterReferences(references: Link[] | undefined): Link[] {
        if (!references) return [];

        if (this.plugin.settings.countUniqueFilesOnly) {
            const seenFiles = new Set<string>();
            return references.filter(link => {
                const path = link.sourceFile?.path;
                if (!path) return false;
                if (seenFiles.has(path)) return false;
                seenFiles.add(path);
                return true;
            });
        }

        return references;
    }

    /**
     * Adds to the indexedReferences map all outgoing links from a given file
     * @param file The file to process
     * @param cache The cached metadata for the file
     */
    getLinkReferencesForFile(file: TFile, cache: any): void {
        if (this.plugin.settings.enableIgnoreObsExcludeFoldersLinksFrom && file?.path && this.plugin.app.metadataCache.isUserIgnored(file?.path)) {
            return;
        }
        for (const item of [cache?.links, cache?.embeds, cache?.frontmatterLinks]) {
            if (!item) continue;
            for (const ref of item) {
                const { path, subpath } = ref.link.startsWith("#") // if link is pointing to itself, create a full path
                    ? parseLinktext(file.path.replace(`.${file.extension}`, "") + ref.link)
                    : parseLinktext(ref.link);
                const tfileDestination = this.plugin.app.metadataCache.getFirstLinkpathDest(path, "/");
                if (tfileDestination) {
                    if (
                        this.plugin.settings.enableIgnoreObsExcludeFoldersLinksTo &&
                        tfileDestination?.path &&
                        this.plugin.app.metadataCache.isUserIgnored(tfileDestination.path)
                    ) {
                        continue;
                    }
                    // if the file has a property snw-index-exclude set to true, exclude it from the index
                    if (this.plugin.app.metadataCache.getFileCache(tfileDestination)?.frontmatter?.["snw-index-exclude"] === true) continue;

                    const linkWithFullPath = (tfileDestination ? tfileDestination.path + subpath : path).toLocaleUpperCase();
                    this.indexedReferences.set(linkWithFullPath, [
                        ...(this.indexedReferences.get(linkWithFullPath) || []),
                        {
                            realLink: ref.link,
                            reference: ref,
                            resolvedFile: tfileDestination,
                            sourceFile: file,
                        },
                    ]);
                } else {
                    // Null if it is a ghost file link, Create Ghost link
                    const link = ref.link.toLocaleUpperCase();
                    this.indexedReferences.set(link, [
                        ...(this.indexedReferences.get(link) || []),
                        {
                            realLink: ref.link,
                            reference: ref,
                            // mock up ghost file for linking
                            resolvedFile: {
                                path: `${path}.md`,
                                name: `${path}.md`,
                                basename: path,
                                extension: "md",
                            } as TFile,
                            sourceFile: file,
                        },
                    ]);
                }
            }
        }
    }

    /**
     * Removes existing references from the map
     * @param file The file to remove references for
     */
    removeLinkReferencesForFile(file: TFile): void {
        for (const [key, items] of this.indexedReferences.entries()) {
            const filtered = items.filter((item: Link) => item?.sourceFile?.path !== file.path);
            filtered.length === 0 ? this.indexedReferences.delete(key) : this.indexedReferences.set(key, filtered);
        }
    }

    /**
     * Builds a list of cache references for resolving the block count
     */
    buildLinksAndReferences(): void {
        if (this.plugin.showCountsActive !== true) return;

        this.indexedReferences = new Map();
        for (const file of this.plugin.app.vault.getMarkdownFiles()) {
            const fileCache = this.plugin.app.metadataCache.getFileCache(file);
            if (fileCache) this.getLinkReferencesForFile(file, fileCache);
        }

        if (window.snwAPI) window.snwAPI.references = this.indexedReferences;
        this.lastUpdateToReferences = Date.now();
    }

    /**
     * Provides an optimized view of the cache for determining the block count for references in a given page
     * @param file The file to get cache for
     * @returns The transformed cache
     */
    getSNWCacheByFile(file: TFile): TransformedCache {
        if (this.plugin.showCountsActive !== true) return {};

        // Check if references have been updated since last cache update, and if cache is old
        const cachedPage = this.cacheCurrentPages.get(file.path.toLocaleUpperCase());
        if (cachedPage) {
            const cachedPageCreateDate = cachedPage.createDate ?? 0;
            if (this.lastUpdateToReferences < cachedPageCreateDate && cachedPageCreateDate + 1000 > Date.now()) {
                return cachedPage;
            }
        }

        const transformedCache: TransformedCache = {};
        const cachedMetaData = this.plugin.app.metadataCache.getFileCache(file);
        if (!cachedMetaData) return transformedCache;
        const filePathInUppercase = file.path.toLocaleUpperCase();

        if (!this.indexedReferences.size) this.buildLinksAndReferences();

        if (cachedMetaData?.headings) {
            // filter - first confirm there are references
            // map - map to the transformed cache
            const baseFilePath = `${filePathInUppercase}#`;
            const tempCacheHeadings = cachedMetaData.headings
                .filter((header) => {
                    return this.indexedReferences.has(baseFilePath + stripHeading(header.heading).toLocaleUpperCase());
                })
                .map((header) => {
                    const key = baseFilePath + stripHeading(header.heading).toLocaleUpperCase();
                    return {
                        original: "#".repeat(header.level) + header.heading,
                        key,
                        headerMatch: header.heading.replace(/\[|\]/g, ""),
                        pos: header.position,
                        page: file.basename,
                        type: "heading" as const,
                        references: this.indexedReferences.get(key) || [],
                    };
                });
            if (tempCacheHeadings.length > 0) transformedCache.headings = tempCacheHeadings;
        }

        if (cachedMetaData?.blocks) {
            // First confirm there are references to the block
            // then map the block to the transformed cache
            const tempCacheBlocks = Object.values(cachedMetaData.blocks)
                .filter((block) => (this.indexedReferences.get(`${filePathInUppercase}#^${block.id.toUpperCase()}`)?.length || 0) > 0)
                .map((block) => {
                    const key = `${filePathInUppercase}#^${block.id.toLocaleUpperCase()}`;
                    return {
                        key,
                        pos: block.position,
                        page: file.basename,
                        type: "block" as const,
                        references: this.indexedReferences.get(key) || [],
                    };
                });
            if (tempCacheBlocks.length > 0) transformedCache.blocks = tempCacheBlocks;
        }

        if (cachedMetaData?.links) {
            const tempCacheLinks = cachedMetaData.links
                .filter((link) => {
                    const linkPath =
                        this.parseLinkTextToFullPath(link.link.startsWith("#") ? filePathInUppercase + link.link : link.link).toLocaleUpperCase() ||
                        link.link.toLocaleUpperCase();
                    const refs = this.indexedReferences.get(linkPath);
                    return refs && refs.length > 0;
                })
                .map((link) => {
                    const linkPath =
                        this.parseLinkTextToFullPath(link.link.startsWith("#") ? filePathInUppercase + link.link : link.link).toLocaleUpperCase() ||
                        link.link.toLocaleUpperCase();

                    const result = {
                        key: linkPath,
                        original: link.original,
                        type: "link" as const,
                        pos: link.position,
                        page: file.basename,
                        references: this.indexedReferences.get(linkPath) || [],
                    };

                    // Handle heading references in one pass
                    if (linkPath.includes("#") && !linkPath.includes("#^")) {
                        result.original = linkPath.split("#")[1];
                    }

                    return result;
                });
            if (tempCacheLinks.length > 0) transformedCache.links = tempCacheLinks;
        }

        if (cachedMetaData?.embeds) {
            const tempCacheEmbeds = cachedMetaData.embeds
                .filter((embed) => {
                    const embedPath =
                        (embed.link.startsWith("#")
                            ? this.parseLinkTextToFullPath(filePathInUppercase + embed.link)
                            : this.parseLinkTextToFullPath(embed.link)
                        ).toLocaleUpperCase() || embed.link.toLocaleUpperCase();
                    const key = embedPath.startsWith("#") ? `${file.basename}${embedPath}` : embedPath;
                    const refs = this.indexedReferences.get(key);
                    return refs && refs.length > 0;
                })
                .map((embed) => {
                    const getEmbedPath = () => {
                        const rawPath = embed.link.startsWith("#") ? filePathInUppercase + embed.link : embed.link;
                        return this.parseLinkTextToFullPath(rawPath).toLocaleUpperCase() || embed.link.toLocaleUpperCase();
                    };

                    const embedPath = getEmbedPath();
                    const key = embedPath.startsWith("#") ? `${file.basename}${embedPath}` : embedPath;
                    const [_, original] = key.includes("#") && !key.includes("#^") ? key.split("#") : [];

                    return {
                        key,
                        page: file.basename,
                        type: "embed" as const,
                        pos: embed.position,
                        references: this.indexedReferences.get(key) || [],
                        ...(original && { original }),
                    };
                });
            if (tempCacheEmbeds.length > 0) transformedCache.embeds = tempCacheEmbeds;
        }

        if (cachedMetaData?.frontmatterLinks) {
            // filter - first confirm there are references
            // map - map to the transformed cache
            const tempCacheFrontmatter = cachedMetaData.frontmatterLinks
                .filter((link) => this.indexedReferences.has(this.parseLinkTextToFullPath(link.link).toLocaleUpperCase() || link.link.toLocaleUpperCase()))
                .map((link) => {
                    const linkPath = this.parseLinkTextToFullPath(link.link).toLocaleUpperCase() || link.link.toLocaleUpperCase();
                    return {
                        key: linkPath,
                        original: link.original,
                        type: "frontmatterLink" as const,
                        pos: { start: { line: -1, col: -1, offset: -1 }, end: { line: -1, col: -1, offset: -1 } },
                        displayText: link.displayText,
                        page: file.basename,
                        references: this.indexedReferences.get(linkPath) || [],
                    };
                });
            if (tempCacheFrontmatter.length > 0) transformedCache.frontmatterLinks = tempCacheFrontmatter;
        }

        transformedCache.cacheMetaData = cachedMetaData;
        transformedCache.createDate = Date.now();
        this.cacheCurrentPages.set(file.path.toLocaleUpperCase(), transformedCache);

        return transformedCache;
    }
} 