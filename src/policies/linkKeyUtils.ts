import { Link } from "../types";
import { parseLinktext } from "obsidian";
import { basename, extname } from "path";

/**
 * Extracts the subpath (section) from a link if present
 * @param link The link to extract from
 * @returns The subpath with # prefix or undefined if none
 */
export function extractSubpath(link: Link): string | undefined {
    const parsed = parseLinktext(link.reference.link);
    return parsed.subpath ? `#${parsed.subpath}` : undefined;
}

/**
 * Normalizes a base path from a link, handling extensions and casing
 * @param link The link to normalize
 * @param uppercase Whether to use uppercase (default: true)
 * @returns Normalized path string
 */
export function normalizeBase(link: Link, uppercase = true): string {
    // Get the base path from resolved file or real link
    let path = link.resolvedFile?.path || link.realLink;
    
    // Add subpath if present
    const subpath = extractSubpath(link);
    if (subpath) {
        path += subpath;
    }
    
    // Add extension if not present and not a section link
    if (!subpath && !extname(path)) {
        path += uppercase ? ".MD" : ".md";
    }
    
    // Apply casing
    return uppercase ? path.toUpperCase() : path.toLowerCase();
}

/**
 * Gets the basename of a path without extension
 * @param path The path to process
 * @returns The basename without extension
 */
export function getBasenameWithoutExt(path: string): string {
    return basename(path, extname(path));
} 