import { Link } from "../types";
import { parseLinktext } from "obsidian";

/**
 * Interface for different policies to determine how wikilinks should be considered equivalent
 */
export interface WikilinkEquivalencePolicy {
    /** Display name of the policy */
    name: string;
    
    /** 
     * Generate a unique key for a link that will be used for grouping equivalent links
     * @param link The link to generate a key for
     * @returns A string key that represents the equivalence class
     */
    generateKey(link: Link): string;
    
    /**
     * Helper method to normalize a file name for consistent key generation
     * Ensures .md extension is consistently handled
     * @param filename The filename to normalize
     * @returns Normalized filename
     */
    normalizeFileName(filename: string): string;
    
    /**
     * Count references according to the policy's rules
     * @param references Array of Link objects to count
     * @returns The number of references according to this policy
     */
    countReferences(references: Link[] | undefined): number;
    
    /**
     * Filter references according to the policy's rules
     * @param references Array of Link objects to filter
     * @returns Filtered array of references
     */
    filterReferences(references: Link[] | undefined): Link[];
}

/**
 * Abstract base class implementing common functionality for wikilink equivalence policies
 */
export abstract class AbstractWikilinkEquivalencePolicy implements WikilinkEquivalencePolicy {
    abstract name: string;
    
    /**
     * Default implementation for normalizing filenames
     * Adds .MD extension if not present and not a section link
     * @param filename The filename to normalize
     * @param toUpperCase Whether to convert to uppercase (default: true)
     * @returns Normalized filename
     */
    normalizeFileName(filename: string, toUpperCase = true): string {
        // Convert case if needed
        let normalized = toUpperCase ? filename.toLocaleUpperCase() : filename.toLowerCase();
        
        // Add extension if not present and not a section link
        const extension = toUpperCase ? ".MD" : ".md";
        if (!normalized.includes("#") && !normalized.endsWith(extension)) {
            normalized += extension;
        }
        
        return normalized;
    }
    
    /**
     * Helper method to extract subpath from a link
     * Gets the part after the # in a link, if present
     * @param link The link to extract from
     * @returns The subpath or undefined if none
     */
    protected extractSubpath(link: Link): string | undefined {
        const parsed = parseLinktext(link.reference.link);
        return parsed.subpath ? `#${parsed.subpath}` : undefined;
    }
    
    /**
     * Base implementation to get a path for key generation
     * @param link The link to get path from
     * @returns The normalized path
     */
    protected getBasePath(link: Link): string {
        return link.resolvedFile ? 
            link.resolvedFile.path : 
            link.realLink;
    }
    
    /**
     * Each policy must implement its own key generation logic
     */
    abstract generateKey(link: Link): string;
    
    /**
     * Default implementation that simply counts all references
     * @param references Array of Link objects to count
     * @returns The total number of references
     */
    countReferences(references: Link[] | undefined): number {
        return references ? references.length : 0;
    }
    
    /**
     * Default implementation that returns all references
     * @param references Array of Link objects to filter
     * @returns The same array of references
     */
    filterReferences(references: Link[] | undefined): Link[] {
        return references || [];
    }
}

/**
 * Default policy that treats links as case insensitive
 */
export class CaseInsensitivePolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Case Insensitive";
    
    generateKey(link: Link): string {
        // If we have a resolved file path, use that
        if (link.resolvedFile) {
            // For links to sections within files, maintain the section information
            const subpath = this.extractSubpath(link);
            if (subpath) {
                return (link.resolvedFile.path + subpath).toLocaleUpperCase();
            }
            return link.resolvedFile.path.toLocaleUpperCase();
        }
        
        // For unresolved links, normalize the file name
        return this.normalizeFileName(link.realLink);
    }
}

/**
 * Policy that considers links within the same source file as different equivalence classes
 */
export class SameFilePolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Same File Unification";
    
    generateKey(link: Link): string {
        // Extract the base key from resolved file or normalized real link
        const baseKey = link.resolvedFile ? 
            link.resolvedFile.path.toLocaleUpperCase() : 
            this.normalizeFileName(link.realLink);
        
        // Handle section links
        const subpath = this.extractSubpath(link);
        const fullBaseKey = subpath ? `${baseKey}${subpath.toLocaleUpperCase()}` : baseKey;
        
        // Use source file as prefix if available, otherwise use a placeholder
        const sourcePrefix = link.sourceFile ? 
            link.sourceFile.path.toLocaleUpperCase() : 
            "UNLINKED";
            
        return `${sourcePrefix}:${fullBaseKey}`;
    }
}

/**
 * Policy that attempts to unify different word forms (simple implementation)
 */
export class WordFormPolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Word Form Unification";
    
    normalizeFileName(filename: string): string {
        // Override to use lowercase instead of uppercase
        return super.normalizeFileName(filename, false);
    }
    
    generateKey(link: Link): string {
        const baseName = link.resolvedFile?.basename || 
            (link.realLink.split('/').pop() || link.realLink);
            
        // Strip any extension to properly handle suffix removal
        const nameWithoutExtension = baseName.replace(/\.\w+$/, '');
        
        // Simple lemmatization - removes common suffixes
        const normalized = nameWithoutExtension.replace(/(\w+?)(s|es|ing|ed|ness|ity)$/, '$1');
        
        // Add the extension back if the original had one
        if (baseName.includes('.')) {
            return this.normalizeFileName(normalized + (baseName.includes('.md') ? '.md' : ''));
        }
        
        return this.normalizeFileName(normalized);
    }
}

/**
 * Policy that only considers the base filename, ignoring paths and extensions
 */
export class BaseNamePolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Base Name Only";
    
    normalizeFileName(filename: string): string {
        // Remove file extension for base name policy
        return filename.replace(/\.\w+$/, '').toLocaleUpperCase();
    }
     
    generateKey(link: Link): string {
        // Extract just the filename without path or extension
        const path = link.resolvedFile?.path || link.reference.link;
        const fileName = path.split('/').pop() || path;
        return this.normalizeFileName(fileName);
    }
}

/**
 * Policy that only counts each source file once per target, even if it contains multiple references
 */
export class UniqueFilesPolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Unique Files Only";
    
    generateKey(link: Link): string {
        // Use the same key approach as CaseInsensitivePolicy
        // This ensures compatibility with the reference counting logic
        if (link.resolvedFile) {
            // For links to sections within files, maintain the section information
            const subpath = this.extractSubpath(link);
            if (subpath) {
                return (link.resolvedFile.path + subpath).toLocaleUpperCase();
            }
            return link.resolvedFile.path.toLocaleUpperCase();
        }
        
        // For unresolved links, normalize the file name
        return this.normalizeFileName(link.realLink);
    }
    
    /**
     * Override to count each source file only once
     * @param references Array of Link objects to count
     * @returns The number of unique source files
     */
    countReferences(references: Link[] | undefined): number {
        if (!references) return 0;
        
        const uniqueSourceFiles = new Set<string>();
        for (const ref of references) {
            if (ref.sourceFile?.path) {
                uniqueSourceFiles.add(ref.sourceFile.path);
            }
        }
        return uniqueSourceFiles.size;
    }
    
    /**
     * Override to keep only one reference per source file
     * @param references Array of Link objects to filter
     * @returns Filtered array with one reference per source file
     */
    filterReferences(references: Link[] | undefined): Link[] {
        if (!references) return [];
        
        const seenSourceFiles = new Set<string>();
        return references.filter(ref => {
            const sourcePath = ref.sourceFile?.path;
            if (!sourcePath) return false;
            
            // If we've already seen this source file, filter it out
            if (seenSourceFiles.has(sourcePath)) return false;
            
            // Otherwise, add it to the seen set and keep it
            seenSourceFiles.add(sourcePath);
            return true;
        });
    }
} 