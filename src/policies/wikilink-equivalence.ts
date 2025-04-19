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
}

/**
 * Default policy that treats links as case insensitive
 */
export class CaseInsensitivePolicy implements WikilinkEquivalencePolicy {
    name = "Case Insensitive";
    
    normalizeFileName(filename: string): string {
        // Convert to uppercase for case insensitivity
        let normalized = filename.toLocaleUpperCase();
        
        // Add .MD extension if not present and not a section link
        if (!normalized.includes("#") && !normalized.endsWith(".MD")) {
            normalized += ".MD";
        }
        
        return normalized;
    }
    
    generateKey(link: Link): string {
        // If we have a resolved file path, use that
        if (link.resolvedFile) {
            // For links to sections within files, maintain the section information
            if (link.realLink.includes("#")) {
                const { subpath } = parseLinktext(link.realLink);
                if (subpath) {
                    return (link.resolvedFile.path + subpath).toLocaleUpperCase();
                }
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
export class SameFilePolicy implements WikilinkEquivalencePolicy {
    name = "Same File Unification";
    
    normalizeFileName(filename: string): string {
        // Convert to uppercase for case insensitivity
        let normalized = filename.toLocaleUpperCase();
        
        // Add .MD extension if not present and not a section link
        if (!normalized.includes("#") && !normalized.endsWith(".MD")) {
            normalized += ".MD";
        }
        
        return normalized;
    }
    
    generateKey(link: Link): string {
        const baseKey = link.resolvedFile ? 
            link.resolvedFile.path.toLocaleUpperCase() : 
            this.normalizeFileName(link.realLink);
            
        return `${link.sourceFile?.path.toLocaleUpperCase()}:${baseKey}`;
    }
}

/**
 * Policy that attempts to unify different word forms (simple implementation)
 */
export class WordFormPolicy implements WikilinkEquivalencePolicy {
    name = "Word Form Unification";
    
    normalizeFileName(filename: string): string {
        // Add .md extension if not present and not a section link
        let normalized = filename.toLowerCase();
        
        if (!normalized.includes("#") && !normalized.endsWith(".md")) {
            normalized += ".md";
        }
        
        return normalized;
    }
    
    generateKey(link: Link): string {
        const baseName = link.resolvedFile?.basename || 
            (link.realLink.split('/').pop() || link.realLink);
            
        // Simple lemmatization example - removes common suffixes
        return this.normalizeFileName(baseName)
            .replace(/(\w+)(s|es|ing|ed|ness|ity)$/, '$1');
    }
}

/**
 * Policy that only considers the base filename, ignoring paths and extensions
 */
export class BaseNamePolicy implements WikilinkEquivalencePolicy {
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
 * Collection of all available policies
 */
export const WIKILINK_EQUIVALENCE_POLICIES = {
    CASE_INSENSITIVE: new CaseInsensitivePolicy(),
    SAME_FILE: new SameFilePolicy(),
    WORD_FORM: new WordFormPolicy(),
    BASE_NAME: new BaseNamePolicy()
}; 