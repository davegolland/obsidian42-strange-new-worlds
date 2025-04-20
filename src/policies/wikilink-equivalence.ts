import { Link } from "../types";
import { LancasterStemmer } from 'natural';
import { normalizeBase, extractSubpath, getBasenameWithoutExt } from './linkKeyUtils';

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
    
    abstract generateKey(link: Link): string;
}

/**
 * Default policy that treats links as case insensitive
 */
export class CaseInsensitivePolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Case Insensitive";
    
    generateKey(link: Link): string {
        return normalizeBase(link);
    }
}

/**
 * Policy that considers links within the same source file as different equivalence classes
 */
export class SameFilePolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Same File Unification";
    
    generateKey(link: Link): string {
        const sourcePrefix = link.sourceFile?.path.toUpperCase() ?? "UNLINKED";
        return `${sourcePrefix}:${normalizeBase(link)}`;
    }
}

/**
 * Policy that attempts to unify different word forms (simple implementation)
 */
export class WordFormPolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Word Form Unification";
    
    generateKey(link: Link): string {
        const basePath = normalizeBase(link, false);
        const baseName = getBasenameWithoutExt(basePath);
        const stemmedWords = LancasterStemmer.tokenizeAndStem(baseName);
        return stemmedWords.join('-');
    }
}

/**
 * Policy that only considers the base filename, ignoring paths and extensions
 */
export class BaseNamePolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Base Name Only";
    
    generateKey(link: Link): string {
        const basePath = normalizeBase(link);
        return getBasenameWithoutExt(basePath);
    }
}

/**
 * Policy that only counts each source file once per target, even if it contains multiple references
 */
export class UniqueFilesPolicy extends AbstractWikilinkEquivalencePolicy {
    name = "Unique Files Only";
    
    generateKey(link: Link): string {
        return normalizeBase(link);
    }
    
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
    
    filterReferences(references: Link[] | undefined): Link[] {
        if (!references) return [];
        
        const seenSourceFiles = new Set<string>();
        return references.filter(ref => {
            const sourcePath = ref.sourceFile?.path;
            if (!sourcePath) return false;
            
            if (seenSourceFiles.has(sourcePath)) return false;
            
            seenSourceFiles.add(sourcePath);
            return true;
        });
    }
} 