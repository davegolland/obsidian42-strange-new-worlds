/**
 * DetectionManager - manages implicit link detection
 * Provides detection functionality for regex and dictionary-based implicit links
 */

import type { App, TFile } from "obsidian";
import type { WikilinkEquivalencePolicy } from "../policies/base/WikilinkEquivalencePolicy";
import type { AutoLinkSettings } from "../settings";
import type { DetectedLink } from "../types";
import { DictionaryDetector } from "./DictionaryDetector";
import { RegexDetector } from "./RegexDetector";
import { log } from "../diag";

export class DetectionManager {
	private detector: RegexDetector | DictionaryDetector | null = null;

	constructor(
		private app: App,
		private settings: AutoLinkSettings,
		private policy: WikilinkEquivalencePolicy,
	) {
		// Initialize detector based on settings
		if (settings.detectionMode === "regex") {
			this.detector = new RegexDetector(settings);
		} else if (settings.detectionMode === "dictionary") {
			this.detector = new DictionaryDetector(app, settings, policy);
		}
	}

	async detect(file: TFile, text: string): Promise<DetectedLink[]> {
		if (!this.detector) return [];
		log.debug(`DetectionManager: detecting in ${file.path} (${text.length} chars)`);
		const detected = await this.detector.detect(file, text);
		log.debug(`DetectionManager: found ${detected.length} raw matches in ${file.path}`);
		const resolved = this.resolveConflicts(detected);
		log.debug(`DetectionManager: resolved to ${resolved.length} final matches in ${file.path}`);
		return resolved;
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
		if (settings.detectionMode === "regex") {
			this.detector = new RegexDetector(settings);
		} else if (settings.detectionMode === "dictionary") {
			this.detector = new DictionaryDetector(this.app, settings, this.policy);
		} else {
			this.detector = null;
		}
	}

	/**
	 * Rebuild the detector (useful when settings change)
	 */
	async rebuild(): Promise<void> {
		if (this.detector && typeof this.detector.build === "function") {
			await this.detector.build();
		}
	}
}
