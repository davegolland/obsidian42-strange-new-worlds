import type { Link } from "../types";
import type SNWPlugin from "../main";

export class ReferenceCountingPolicy {
    private plugin: SNWPlugin;

    constructor(plugin: SNWPlugin) {
        this.plugin = plugin;
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
} 