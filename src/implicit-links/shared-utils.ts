import type { TFile } from "obsidian";

/**
 * Generate the same reference key that native SNW counters use.
 * This ensures counts and hover contents match native behavior.
 */
export function generateReferenceKey(plugin: any, linktext: string, fromFile?: TFile | null): string {
	try {
		// Use the active policy's generateKey method for consistency
		const activePolicy = plugin?.referenceCountingPolicy?.activePolicy;
		if (activePolicy?.generateKey) {
			// Create a Link object structure that matches what SNW uses
			const dest = plugin?.app?.metadataCache?.getFirstLinkpathDest?.(linktext, fromFile?.path ?? "");
			const linkObj = {
				realLink: linktext,
				reference: {
					link: linktext,
					key: `${(dest?.path ?? linktext).toUpperCase()}`,
					displayText: linktext,
					position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } },
				},
				resolvedFile:
					dest ||
					({
						path: `${linktext}.md`,
						name: `${linktext}.md`,
						basename: linktext,
						extension: "md",
					} as unknown as TFile),
				sourceFile: fromFile,
			};

			return activePolicy.generateKey(linkObj);
		}
	} catch {}

	// Fallback to the old method if active policy is not available
	const fold = plugin?.wikilinkEquivalencePolicy?.textFold;
	return typeof fold === "function" ? fold(linktext.trim()) : linktext.trim().toUpperCase();
}

/**
 * Get reference count from SNW's indexed references using the active policy.
 * This is the single source of truth for all reference counts.
 */
export function getReferenceCount(plugin: any, key: string): number {
	try {
		const activePolicy = plugin?.referenceCountingPolicy?.activePolicy;
		const indexedRefs = plugin?.referenceCountingPolicy?.indexedReferences;
		const refs = indexedRefs?.get(key);

		if (Array.isArray(refs)) {
			// Use policy hooks for filtering and counting if available
			const filteredRefs = activePolicy?.filterReferences?.(refs) ?? refs;
			return activePolicy?.countReferences?.(filteredRefs) ?? filteredRefs.length;
		}
	} catch {}
	return 0;
}

/**
 * Extract basename without extension from a path or filename
 */
export function basenameNoExt(pathOrName: string): string {
	const base = pathOrName.split("/").pop() ?? pathOrName;
	return base.endsWith(".md") ? base.slice(0, -3) : base;
}
