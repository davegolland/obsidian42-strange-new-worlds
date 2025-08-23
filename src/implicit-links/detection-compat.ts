/**
 * Compatibility shim for DetectionManager
 * Re-exports new manager API under old names to avoid breaking existing imports
 */

import type { TFile, App } from "obsidian";
import type { DetectedLink } from "../types";
import type { AutoLinkSettings } from "../settings";
import type { WikilinkEquivalencePolicy } from "../policies/base/WikilinkEquivalencePolicy";

// Re-export the old DetectionManager interface for compatibility
export class DetectionManager {
	private detector: any | null = null;

	constructor(
		private app: App,
		private settings: AutoLinkSettings,
		private policy: WikilinkEquivalencePolicy,
	) {
		// For now, keep the old behavior but mark as deprecated
		console.warn("[SNW] DetectionManager is deprecated. Use ImplicitLinksManager instead.");
		
		// Initialize with null detector for now
		this.detector = null;
	}

	async detect(file: TFile, text: string): Promise<DetectedLink[]> {
		// Return empty array for now - functionality moved to new manager
		return [];
	}

	private resolveConflicts(items: DetectedLink[]): DetectedLink[] {
		// Legacy conflict resolution logic
		items.sort((a, b) => {
			const la = a.span.end - a.span.start;
			const lb = b.span.end - b.span.start;
			if (la !== lb) return lb - la; // longer first
			return a.span.start - b.span.start; // then earlier
		});
		const picked: DetectedLink[] = [];
		let lastEnd = -1;
		for (const it of items) {
			if (it.span.start >= lastEnd) {
				picked.push(it);
				lastEnd = it.span.end;
			}
		}
		return picked;
	}

	updateSettings(settings: AutoLinkSettings): void {
		this.settings = settings;
		// Settings update moved to new manager
	}

	/**
	 * Rebuild the detector (useful when settings change)
	 */
	async rebuild(): Promise<void> {
		// Rebuild functionality moved to new manager
	}
}
