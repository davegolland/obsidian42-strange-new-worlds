import type { Link, TransformedCache, TransformedCachedItem } from "../types";
import type SNWPlugin from "../main";
import { stripHeading, type TFile, parseLinktext } from "obsidian";
import { WIKILINK_EQUIVALENCE_POLICIES, type WikilinkEquivalencePolicy } from "./wikilink-equivalence";

export class ReferenceCountingPolicy {
    private plugin: SNWPlugin;
    private cacheCurrentPages: Map<string, TransformedCache>;
    private lastUpdateToReferences: number;
    private indexedReferences: Map<string, Link[]>;
    private activePolicy: WikilinkEquivalencePolicy = WIKILINK_EQUIVALENCE_POLICIES.CASE_INSENSITIVE;
    private debugMode: boolean = false; // Can be toggled for diagnostics

    constructor(plugin: SNWPlugin) {
        this.plugin = plugin;
        this.cacheCurrentPages = new Map<string, TransformedCache>();
        this.lastUpdateToReferences = 0;
        this.indexedReferences = new Map();
        this.setActivePolicyFromSettings();
    }

    /**
     * Sets the active equivalence policy based on the current settings
     */
    private setActivePolicyFromSettings(): void {
        switch (this.plugin.settings.wikilinkEquivalencePolicy) {
            case "case-insensitive":
                this.activePolicy = WIKILINK_EQUIVALENCE_POLICIES.CASE_INSENSITIVE;
                break;
            case "same-file":
                this.activePolicy = WIKILINK_EQUIVALENCE_POLICIES.SAME_FILE;
                break;
            case "word-form":
                this.activePolicy = WIKILINK_EQUIVALENCE_POLICIES.WORD_FORM;
                break;
            case "base-name":
                this.activePolicy = WIKILINK_EQUIVALENCE_POLICIES.BASE_NAME;
                break;
            case "unique-files":
                this.activePolicy = WIKILINK_EQUIVALENCE_POLICIES.UNIQUE_FILES;
                break;
            default:
                this.activePolicy = WIKILINK_EQUIVALENCE_POLICIES.CASE_INSENSITIVE;
        }
    }

    /**
     * Updates the active policy and rebuilds the reference index
     * @param policyType The policy type to set as active
     */
    setActivePolicy(policyType: string): void {
        if (this.plugin.settings.wikilinkEquivalencePolicy !== policyType) {
            this.plugin.settings.wikilinkEquivalencePolicy = policyType as any;
            this.plugin.saveSettings();
        }
        
        this.setActivePolicyFromSettings();
        this.invalidateCache();
        this.buildLinksAndReferences();
    }

    /**
     * Gets the current active policy
     * @returns The active wikilink equivalence policy
     */
    getActivePolicy(): WikilinkEquivalencePolicy {
        return this.activePolicy;
    }

    /**
     * Generates a key for a link using the active policy
     * @param link The link to generate a key for
     * @returns The key for this link according to the active policy
     */
    private generateKey(link: Link): string {
        return this.activePolicy.generateKey(link);
    }

    /**
     * Public method to generate a consistent key for UI components
     * @param link The link to generate a key for
     * @returns The key for this link according to the active policy
     */
    public generateKeyForUI(link: Link): string {
        return this.activePolicy.generateKey(link);
    }

    /**
     * Generates a key from a path and link for UI components
     * This is a helper method for UI components that don't have a full Link object
     * @param filePath The path of the file containing the link
     * @param linkText The text of the link
     * @returns The key for this link according to the active policy
     */
    public generateKeyFromPathAndLink(filePath: string, linkText: string): string {
        const { path, subpath } = parseLinktext(linkText);
        
        // Get the resolved file if possible
        let resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(path, filePath);
        
        // Handle ghost links - if no resolved file but looks like a file reference
        if (!resolvedFile && !linkText.startsWith("#") && path) {
            // Add .md extension if not present for comparison with indexed keys
            const ghostPath = path.toLowerCase().endsWith('.md') ? path : `${path}.md`;
            
            // Create a temporary Link object for ghost files
            const ghostLink: Link = {
                realLink: linkText,
                reference: {
                    link: linkText,
                    key: `${filePath}${linkText}`,
                    displayText: linkText,
                    position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } }
                },
                resolvedFile: {
                    path: ghostPath,
                    name: ghostPath.split('/').pop() || ghostPath,
                    basename: path,
                    extension: "md",
                } as TFile,
                sourceFile: null
            };
            
            return this.generateKey(ghostLink);
        }
        
        // Create a temporary Link object with resolved file
        const link: Link = {
            realLink: linkText,
            reference: {
                link: linkText,
                key: `${filePath}${linkText}`,
                displayText: linkText,
                position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } }
            },
            resolvedFile: resolvedFile,
            sourceFile: null
        };
        
        if (this.debugMode) {
            console.log(`Generating key for link: ${linkText}`);
            console.log(`  Resolved file: ${resolvedFile?.path || 'None'}`);
            console.log(`  Generated key: ${this.generateKey(link)}`);
        }
        
        return this.generateKey(link);
    }

    /**
     * Invalidates all cached pages, forcing a rebuild on next access
     */
    public invalidateCache(): void {
        this.cacheCurrentPages.clear();
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
        this.setActivePolicyFromSettings();
    }

    /**
     * Get the last update timestamp for references
     * @returns The timestamp of the last update
     */
    getLastUpdateToReferences(): number {
        return this.lastUpdateToReferences;
    }

    /**
     * Counts references based on the current policy
     * @param references Array of Link objects to count
     * @returns The number of references according to the current policy
     */
    countReferences(references: Link[] | undefined): number {
        if (!references) return 0;

        // Delegate counting to the active policy
        return this.activePolicy.countReferences(references);
    }

    /**
     * Filters references based on the current policy
     * @param references Array of Link objects to filter
     * @returns Filtered array of references according to the current policy
     */
    filterReferences(references: Link[] | undefined): Link[] {
        if (!references) return [];

        // Delegate filtering to the active policy
        return this.activePolicy.filterReferences(references);
    }

    /**
     * Builds a list of cache references for resolving the block count
     */
    buildLinksAndReferences(): void {
        if (this.plugin.showCountsActive !== true) return;

        // Clear existing references
        this.indexedReferences = new Map();
        
        // Debug flags
        const logDebugInfo = this.debugMode;
        let totalLinks = 0;
        const keysByType = new Map<string, Set<string>>();
        
        for (const file of this.plugin.app.vault.getMarkdownFiles()) {
            const fileCache = this.plugin.app.metadataCache.getFileCache(file);
            if (fileCache) {
                if (logDebugInfo) {
                    console.log(`Processing file: ${file.path}`);
                    if (fileCache.links) {
                        console.log(`  Links found: ${fileCache.links.length}`);
                    }
                }
                this.getLinkReferencesForFile(file, fileCache);
            }
        }
        
        if (logDebugInfo) {
            console.log(`Total references indexed: ${this.indexedReferences.size}`);
            console.log(`Reference keys: ${Array.from(this.indexedReferences.keys()).slice(0, 10).join(', ')}${this.indexedReferences.size > 10 ? '...' : ''}`);
        }

        if (window.snwAPI) window.snwAPI.references = this.indexedReferences;
        this.lastUpdateToReferences = Date.now();
    }

    /**
     * Adds to the indexedReferences map all outgoing links from a given file
     * @param file The file to process
     * @param cache The cached metadata for the file
     */
    getLinkReferencesForFile(file: TFile, cache: any): void {
        // Debug flags
        const logDebugInfo = this.debugMode;
        
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

                    const link: Link = {
                        realLink: ref.link,
                        reference: ref,
                        resolvedFile: tfileDestination,
                        sourceFile: file,
                    };

                    const linkKey = this.generateKey(link);
                    
                    if (logDebugInfo) {
                        console.log(`Link from ${file.path} -> ${tfileDestination.path}`);
                        console.log(`  Original: ${ref.link}`);
                        console.log(`  Key generated: ${linkKey}`);
                    }
                    
                    this.indexedReferences.set(linkKey, [
                        ...(this.indexedReferences.get(linkKey) || []),
                        link,
                    ]);
                } else {
                    // Null if it is a ghost file link, Create Ghost link
                    const ghostLink: Link = {
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
                    };
                    
                    const linkKey = this.generateKey(ghostLink);
                    
                    if (logDebugInfo) {
                        console.log(`Ghost link from ${file.path} -> ${path}.md`);
                        console.log(`  Original: ${ref.link}`);
                        console.log(`  Key generated: ${linkKey}`);
                    }
                    
                    this.indexedReferences.set(linkKey, [
                        ...(this.indexedReferences.get(linkKey) || []),
                        ghostLink,
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
     * Provides an optimized view of the cache for determining the block count for references in a given page
     * @param file The file to get cache for
     * @returns The transformed cache
     */
    getSNWCacheByFile(file: TFile): TransformedCache {
        // Debug flags
        const logDebugInfo = this.debugMode;
        
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
            // Create a heading link object that can be used with the policy
            const createHeadingLink = (header: any, filePath: string) => {
                return {
                    realLink: `#${stripHeading(header.heading)}`,
                    reference: {
                        link: `#${stripHeading(header.heading)}`,
                        key: `${filePath}#${stripHeading(header.heading)}`,
                        displayText: header.heading,
                        position: header.position
                    },
                    resolvedFile: file,
                    sourceFile: file
                } as Link;
            };

            // Filter and map headings
            const tempCacheHeadings = cachedMetaData.headings
                .map(header => {
                    const headingLink = createHeadingLink(header, file.path);
                    const key = this.generateKey(headingLink);
                    
                    // Check if we have references with this key
                    const refs = this.findReferencesWithFallback(key, headingLink);
                    if (!refs || refs.length === 0) return null;
                    
                    return {
                        original: "#".repeat(header.level) + header.heading,
                        key,
                        headerMatch: header.heading.replace(/\[|\]/g, ""),
                        pos: header.position,
                        page: file.basename,
                        type: "heading" as const,
                        references: refs
                    };
                })
                .filter(Boolean) as TransformedCachedItem[]; // Type cast to remove null entries
                
            if (tempCacheHeadings.length > 0) transformedCache.headings = tempCacheHeadings;
        }

        if (cachedMetaData?.blocks) {
            // Create a block link object that can be used with the policy
            const createBlockLink = (block: any, filePath: string) => {
                return {
                    realLink: `#^${block.id}`,
                    reference: {
                        link: `#^${block.id}`,
                        key: `${filePath}#^${block.id}`,
                        displayText: block.id,
                        position: block.position
                    },
                    resolvedFile: file,
                    sourceFile: file
                } as Link;
            };
            
            // Filter and map blocks
            const tempCacheBlocks = Object.values(cachedMetaData.blocks)
                .map(block => {
                    const blockLink = createBlockLink(block, file.path);
                    const key = this.generateKey(blockLink);
                    
                    // Check if we have references with this key
                    const refs = this.findReferencesWithFallback(key, blockLink);
                    if (!refs || refs.length === 0) return null;
                    
                    return {
                        key,
                        pos: block.position,
                        page: file.basename,
                        type: "block" as const,
                        references: refs
                    };
                })
                .filter(Boolean) as TransformedCachedItem[]; // Type cast to remove null entries
                
            if (tempCacheBlocks.length > 0) transformedCache.blocks = tempCacheBlocks;
        }

        if (cachedMetaData?.links) {
            // Create a link object that can be used with the policy
            const createLinkObject = (link: any, filePath: string) => {
                // If link starts with #, it's an internal link to the current file
                let resolvedFile = null;
                let realPath = "";
                
                if (link.link.startsWith("#")) {
                    // Internal link to a section in the current file
                    const { path, subpath } = parseLinktext(filePath.replace(`.${file.extension}`, "") + link.link);
                    resolvedFile = file;
                    realPath = file.path + (subpath || "");
                } else {
                    // External link to another file
                    const { path, subpath } = parseLinktext(link.link);
                    resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(path, "/");
                    realPath = resolvedFile ? (resolvedFile.path + (subpath || "")) : link.link;
                }
                
                return {
                    realLink: link.link,
                    reference: link,
                    resolvedFile: resolvedFile,
                    sourceFile: file
                } as Link;
            };
            
            // Filter and map links
            const tempCacheLinks = cachedMetaData.links
                .map(link => {
                    const linkObj = createLinkObject(link, file.path);
                    const key = this.generateKey(linkObj);
                    
                    // Log lookups for debugging
                    if (logDebugInfo) {
                        console.log(`Looking up link: ${link.link}`);
                        console.log(`  Generated key: ${key}`);
                        console.log(`  Found references: ${this.indexedReferences.has(key) ? this.indexedReferences.get(key)?.length : 'none'}`);
                        
                        // Debug: find similar keys that might match
                        if (!this.indexedReferences.has(key)) {
                            const similarKeys = Array.from(this.indexedReferences.keys())
                                .filter(k => k.includes(link.link.toLocaleUpperCase()) || 
                                            (linkObj.resolvedFile && k.includes(linkObj.resolvedFile.path.toLocaleUpperCase())))
                                .slice(0, 5);
                            
                            if (similarKeys.length > 0) {
                                console.log(`  Similar keys in index: ${similarKeys.join(', ')}`);
                            }
                        }
                    }
                    
                    // Check if we have references with this key
                    const refs = this.findReferencesWithFallback(key, linkObj);
                    if (!refs || refs.length === 0) return null;
                    
                    const result = {
                        key,
                        original: link.original,
                        type: "link" as const,
                        pos: link.position,
                        page: file.basename,
                        references: refs
                    };

                    // Handle heading references in one pass
                    if (key.includes("#") && !key.includes("#^")) {
                        result.original = key.split("#")[1];
                    }

                    return result;
                })
                .filter(Boolean) as TransformedCachedItem[]; // Type cast to remove null entries
                
            if (tempCacheLinks.length > 0) transformedCache.links = tempCacheLinks;
        }

        if (cachedMetaData?.embeds) {
            // Create an embed link object that can be used with the policy
            const createEmbedLink = (embed: any, filePath: string) => {
                // If embed starts with #, it's an internal link to the current file
                let resolvedFile = null;
                let realPath = "";
                
                if (embed.link.startsWith("#")) {
                    // Internal link to a section in the current file
                    const { path, subpath } = parseLinktext(filePath.replace(`.${file.extension}`, "") + embed.link);
                    resolvedFile = file;
                    realPath = file.path + (subpath || "");
                } else {
                    // External link to another file
                    const { path, subpath } = parseLinktext(embed.link);
                    resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(path, "/");
                    realPath = resolvedFile ? (resolvedFile.path + (subpath || "")) : embed.link;
                }
                
                return {
                    realLink: embed.link,
                    reference: embed,
                    resolvedFile: resolvedFile,
                    sourceFile: file
                } as Link;
            };
            
            // Filter and map embeds
            const tempCacheEmbeds = cachedMetaData.embeds
                .map(embed => {
                    const embedLink = createEmbedLink(embed, file.path);
                    const key = this.generateKey(embedLink);
                    
                    // Check if we have references with this key
                    const refs = this.findReferencesWithFallback(key, embedLink);
                    if (!refs || refs.length === 0) return null;
                    
                    const [_, original] = key.includes("#") && !key.includes("#^") ? key.split("#") : [];
                    
                    return {
                        key,
                        page: file.basename,
                        type: "embed" as const,
                        pos: embed.position,
                        references: refs,
                        ...(original && { original }),
                    };
                })
                .filter(Boolean) as TransformedCachedItem[]; // Type cast to remove null entries
                
            if (tempCacheEmbeds.length > 0) transformedCache.embeds = tempCacheEmbeds;
        }

        if (cachedMetaData?.frontmatterLinks) {
            // Create a frontmatter link object that can be used with the policy
            const createFrontmatterLink = (link: any) => {
                const { path, subpath } = parseLinktext(link.link);
                const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(path, "/");
                
                return {
                    realLink: link.link,
                    reference: link,
                    resolvedFile: resolvedFile,
                    sourceFile: file
                } as Link;
            };
            
            // Filter and map frontmatter links
            const tempCacheFrontmatter = cachedMetaData.frontmatterLinks
                .map(link => {
                    const frontmatterLink = createFrontmatterLink(link);
                    const key = this.generateKey(frontmatterLink);
                    
                    // Check if we have references with this key
                    const refs = this.findReferencesWithFallback(key, frontmatterLink);
                    if (!refs || refs.length === 0) return null;
                    
                    return {
                        key,
                        original: link.original,
                        type: "frontmatterLink" as const,
                        pos: { start: { line: -1, col: -1, offset: -1 }, end: { line: -1, col: -1, offset: -1 } },
                        displayText: link.displayText,
                        page: file.basename,
                        references: refs
                    };
                })
                .filter(Boolean) as TransformedCachedItem[]; // Type cast to remove null entries
                
            if (tempCacheFrontmatter.length > 0) transformedCache.frontmatterLinks = tempCacheFrontmatter;
        }

        transformedCache.cacheMetaData = cachedMetaData;
        transformedCache.createDate = Date.now();
        this.cacheCurrentPages.set(file.path.toLocaleUpperCase(), transformedCache);

        return transformedCache;
    }

    /**
     * Attempts to find references using alternative lookup methods if the primary lookup fails
     * This helps with backward compatibility and transitioning between policies
     */
    private findReferencesWithFallback(key: string, link: any): Link[] | undefined {
        // First, try the direct lookup with the generated key
        let refs = this.indexedReferences.get(key);
        if (refs && refs.length > 0) return refs;
        
        // Log when in debug mode
        if (this.debugMode) {
            console.log(`No references found for key: ${key}`);
            console.log(`Trying fallbacks for: ${link.realLink}`);
            
            // Show available keys that might be similar
            const possibleMatches = Array.from(this.indexedReferences.keys())
                .filter(k => {
                    const simplifiedKey = key.replace(/\.\w+$/, '').toLocaleUpperCase();
                    const simplifiedK = k.replace(/\.\w+$/, '').toLocaleUpperCase();
                    return k.includes(key) || 
                           key.includes(k) || 
                           simplifiedK === simplifiedKey ||
                           (link.resolvedFile && k.includes(link.resolvedFile.path.toLocaleUpperCase()));
                })
                .slice(0, 5);
                
            if (possibleMatches.length > 0) {
                console.log(`  Possible matching keys in index: ${possibleMatches.join(', ')}`);
            }
        }
        
        // Try adding .MD extension if missing
        if (!key.includes("#") && !key.endsWith(".MD")) {
            const keyWithExt = key + ".MD";
            refs = this.indexedReferences.get(keyWithExt);
            if (refs && refs.length > 0) {
                if (this.debugMode) console.log(`Found using extension fallback: ${keyWithExt}`);
                return refs;
            }
        }
        
        // Fallback 1: Try with the original uppercase method
        if (link.resolvedFile) {
            const fallbackKey = link.resolvedFile.path.toLocaleUpperCase();
            refs = this.indexedReferences.get(fallbackKey);
            if (refs && refs.length > 0) {
                if (this.debugMode) console.log(`Found using fallback (path): ${fallbackKey}`);
                return refs;
            }
            
            // If the link has a subpath, try with that too
            if (link.realLink.includes("#")) {
                const { subpath } = parseLinktext(link.realLink);
                if (subpath) {
                    const fallbackKeyWithSubpath = (link.resolvedFile.path + subpath).toLocaleUpperCase();
                    refs = this.indexedReferences.get(fallbackKeyWithSubpath);
                    if (refs && refs.length > 0) {
                        if (this.debugMode) console.log(`Found using fallback (path+subpath): ${fallbackKeyWithSubpath}`);
                        return refs;
                    }
                }
            }
        }
        
        // Fallback 2: Try with the original link
        const fallbackKeyOriginal = link.realLink.toLocaleUpperCase();
        refs = this.indexedReferences.get(fallbackKeyOriginal);
        if (refs && refs.length > 0) {
            if (this.debugMode) console.log(`Found using fallback (original): ${fallbackKeyOriginal}`);
            return refs;
        }
        
        // Fallback 3: Try with the original link + .MD extension
        if (!fallbackKeyOriginal.includes("#") && !fallbackKeyOriginal.endsWith(".MD")) {
            const fallbackWithExt = fallbackKeyOriginal + ".MD";
            refs = this.indexedReferences.get(fallbackWithExt);
            if (refs && refs.length > 0) {
                if (this.debugMode) console.log(`Found using fallback (original+ext): ${fallbackWithExt}`);
                return refs;
            }
        }
        
        // No references found
        if (this.debugMode) console.log(`No references found after all fallbacks`);
        return undefined;
    }

    /**
     * Enables or disables debug mode for diagnostics
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'} for ReferenceCountingPolicy`);
        
        if (enabled) {
            // Print a summary of the references when enabling debug mode
            this.dumpReferencesSummary();
        }
    }
    
    /**
     * Dumps a summary of all indexed references for debugging
     */
    dumpReferencesSummary(): void {
        if (!this.debugMode) return;
        
        const total = this.indexedReferences.size;
        console.log(`Total indexed references: ${total}`);
        
        if (total > 0) {
            console.log(`First 10 reference keys:`);
            let count = 0;
            for (const key of this.indexedReferences.keys()) {
                if (count++ < 10) {
                    const refs = this.indexedReferences.get(key) || [];
                    console.log(`  ${key} (${refs.length} references)`);
                    
                    // Show first reference's details
                    if (refs.length > 0) {
                        const firstRef = refs[0];
                        console.log(`    From: ${firstRef.sourceFile?.path || 'unknown'}`);
                        console.log(`    To: ${firstRef.resolvedFile?.path || 'unknown'}`);
                        console.log(`    RealLink: ${firstRef.realLink}`);
                    }
                } else {
                    break;
                }
            }
            
            // Also list keys containing "project" to help find specific references
            console.log(`Looking for keys containing "project":`);
            const projectKeys = Array.from(this.indexedReferences.keys())
                .filter(k => k.toLowerCase().includes("project"));
                
            if (projectKeys.length > 0) {
                projectKeys.slice(0, 5).forEach(k => {
                    const refs = this.indexedReferences.get(k) || [];
                    console.log(`  ${k} (${refs.length} references)`);
                });
                
                if (projectKeys.length > 5) {
                    console.log(`  ... and ${projectKeys.length - 5} more`);
                }
            } else {
                console.log(`  No keys containing "project" found`);
            }
        }
    }

    /**
     * Checks if debug mode is enabled
     */
    isDebugModeEnabled(): boolean {
        return this.debugMode;
    }

    /**
     * Finds all references for a link across all source files, regardless of the active policy
     * This is important for UI components that need to work with any policy
     * 
     * @param filePath The path of the file containing the link
     * @param linkText The text of the link to find references for
     * @returns All references found for this link
     */
    public findAllReferencesForLink(filePath: string, linkText: string): Link[] {
        if (this.debugMode) {
            console.log(`Finding all references for link: ${linkText} in ${filePath}`);
        }
        
        // Generate key with current policy
        const key = this.generateKeyFromPathAndLink(filePath, linkText);
        let allRefs: Link[] = [];
        
        // First check with the current policy's key
        const refsWithCurrentPolicy = this.indexedReferences.get(key);
        if (refsWithCurrentPolicy && refsWithCurrentPolicy.length > 0) {
            allRefs = allRefs.concat(refsWithCurrentPolicy);
            if (this.debugMode) console.log(`  Found ${refsWithCurrentPolicy.length} refs with current policy key: ${key}`);
        }
        
        // If Same File policy is active, we need to check for references across all source files
        if (this.activePolicy === WIKILINK_EQUIVALENCE_POLICIES.SAME_FILE) {
            // Try without the source file prefix to find CaseInsensitive-style keys
            const { path, subpath } = parseLinktext(linkText);
            const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(path, filePath);
            
            let alternateKey = "";
            if (resolvedFile) {
                alternateKey = resolvedFile.path.toLocaleUpperCase();
                if (subpath) alternateKey += subpath.toLocaleUpperCase();
            } else if (path) {
                // Handle ghost links
                alternateKey = path.toLowerCase().endsWith('.md') ? 
                    path.toLocaleUpperCase() : 
                    path.toLocaleUpperCase() + ".MD";
            }
            
            if (alternateKey && alternateKey !== key) {
                const altRefs = this.indexedReferences.get(alternateKey);
                if (altRefs && altRefs.length > 0) {
                    if (this.debugMode) console.log(`  Found ${altRefs.length} refs with alternate key: ${alternateKey}`);
                    allRefs = allRefs.concat(altRefs);
                }
            }
            
            // Also search for any keys that might be prefixed with other source files
            const sourceFilePrefix = filePath.toLocaleUpperCase() + ":";
            const matchingKeys = Array.from(this.indexedReferences.keys())
                .filter(k => k.includes(":") && k.split(":")[1] === alternateKey);
                
            for (const matchKey of matchingKeys) {
                if (matchKey !== key) {
                    const matchRefs = this.indexedReferences.get(matchKey);
                    if (matchRefs && matchRefs.length > 0) {
                        if (this.debugMode) console.log(`  Found ${matchRefs.length} refs with related key: ${matchKey}`);
                        allRefs = allRefs.concat(matchRefs);
                    }
                }
            }
        }
        
        // If we're using Case Insensitive or other policy, but Same File style keys exist
        if (this.activePolicy !== WIKILINK_EQUIVALENCE_POLICIES.SAME_FILE) {
            // Look for any Same File style keys (file:target format)
            const potentialKeys = Array.from(this.indexedReferences.keys())
                .filter(k => k.includes(":") && k.endsWith(":" + key));
                
            for (const matchKey of potentialKeys) {
                if (matchKey !== key) {
                    const matchRefs = this.indexedReferences.get(matchKey);
                    if (matchRefs && matchRefs.length > 0) {
                        if (this.debugMode) console.log(`  Found ${matchRefs.length} refs with prefixed key: ${matchKey}`);
                        allRefs = allRefs.concat(matchRefs);
                    }
                }
            }
        }
        
        if (this.debugMode) {
            console.log(`Total references found: ${allRefs.length}`);
        }
        
        return allRefs;
    }
} 