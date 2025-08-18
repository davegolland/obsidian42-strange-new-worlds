import type { TFile, CachedMetadata } from "obsidian";
import type { VirtualLinkProvider } from "../types";
import type { AutoLinkSettings } from "../settings";
import type SNWPlugin from "../main";
import { DetectionManager } from "./DetectionManager";
import { offsetRangeToPos, getCleanSegments } from "./utils";

export class ImplicitLinksManager {
	private detectionManager: DetectionManager;
	private unregisterProvider: (() => void) | null = null;
	public providers: VirtualLinkProvider[] = [];

	constructor(private plugin: SNWPlugin, private settings: AutoLinkSettings) {
		this.detectionManager = new DetectionManager(
			plugin.app,
			settings,
			plugin.referenceCountingPolicy.getActivePolicy()
		);
	}

	/**
	 * Register the implicit links provider with the SNW API
	 */
	registerProvider(registerFn: (provider: VirtualLinkProvider) => () => void): void {
		if (this.unregisterProvider) {
			this.unregisterProvider();
		}

		const provider: VirtualLinkProvider = async ({ file, cache, makeLink }) => {
			if (this.settings.detectionMode === "off") return [];
			
			const fullText = await this.plugin.app.vault.read(file);
			// NEW: get "clean" *segments* of the full text instead of mutating the string
			const segments = getCleanSegments(fullText, cache); // [{ text, baseOffset }]
			const links = [];
			for (const seg of segments) {
				const found = await this.detectionManager.detect(file, seg.text);
				for (const item of found) {
					const adjusted = { start: item.span.start + seg.baseOffset, end: item.span.end + seg.baseOffset };
					const pos = offsetRangeToPos(fullText, adjusted);
					// Optional: resolve or fallback during debugging so underline always shows
					const resolved = this.plugin.app.metadataCache.getFirstLinkpathDest(item.targetPath, file.path);
					const target = resolved ? item.targetPath : file.path;
					links.push(makeLink(target, item.display, pos));
				}
			}

			console.log("[ImplicitLinks] returning", links.length, links.slice(0, 3));
			return links;
		};

		// Store the provider for the CM6 extension to access
		this.providers = [provider];

		this.unregisterProvider = registerFn(provider);
	}

	/**
	 * Update settings and recreate the detection manager
	 */
	updateSettings(settings: AutoLinkSettings): void {
		this.settings = settings;
		this.detectionManager.updateSettings(settings);
		// Re-register the provider with updated settings
		if (this.unregisterProvider) {
			this.unregisterProvider();
			this.registerProvider(this.plugin.snwAPI.registerVirtualLinkProvider.bind(this.plugin.snwAPI));
		}
	}

	/**
	 * Clean up the provider registration
	 */
	unload(): void {
		if (this.unregisterProvider) {
			this.unregisterProvider();
			this.unregisterProvider = null;
		}
	}
}
