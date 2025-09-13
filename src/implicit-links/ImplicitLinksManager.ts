import { Transaction } from "@codemirror/state";
import type { CachedMetadata, TFile } from "obsidian";
import type InferredWikilinksPlugin from "../main";
import type { AutoLinkSettings } from "../settings";
import type { VirtualLinkProvider } from "../types";
import { getCleanSegments, offsetRangeToPos } from "./utils";
import { log } from "../diag";

export class ImplicitLinksManager {
	private unregisterProvider: (() => void) | null = null;
	public providers: VirtualLinkProvider[] = [];

	constructor(
		private plugin: InferredWikilinksPlugin,
		private settings: AutoLinkSettings,
	) {
		log.debug("ImplicitLinksManager: initializing (minimal mode)");
		// In minimal mode, detection is always "off" - no DetectionManager needed
	}

	/**
	 * Register the implicit links provider with the InferredWikilinks API
	 */
	registerProvider(registerFn: (provider: VirtualLinkProvider) => () => void): void {
		if (this.unregisterProvider) {
			this.unregisterProvider();
		}

		const provider: VirtualLinkProvider = async ({ file, cache, makeLink }) => {
			// In minimal mode, detection is always "off" - return empty array
			return [];
		};

		// Store the provider for the CM6 extension to access
		this.providers = [provider];

		this.unregisterProvider = registerFn(provider);
	}

	/**
	 * Update settings (minimal mode - no detection manager to update)
	 */
	async updateSettings(settings: AutoLinkSettings): Promise<void> {
		this.settings = settings;
		// In minimal mode, no detection manager to update
	}

	/**
	 * Trigger a refresh of implicit links in all active editors
	 * This should be called when the reference counting policy rebuilds
	 */
	triggerRefresh(): void {
		// Get all markdown editor leaves
		const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			const mdView = leaf.view as any;
			const cm = mdView?.editor?.cm;
			if (cm) {
				// Dispatch a transaction that will trigger the implicit links refresh
				// This simulates a document change to force the implicit links extension to refresh
				cm.dispatch({
					// No actual changes, just a user event that the implicit links extension can watch for
					annotations: Transaction.userEvent.of("implicit-links-refresh"),
				});
			}
		}
	}

	/**
	 * Get InferredWikilinks cache by file (minimal mode - return empty cache)
	 */
	getInferredWikilinksCacheByFile(fileOrPath: any): { byPhrase: Map<string, any>, version: number } {
		// In minimal mode, return empty cache since detection is off
		return { byPhrase: new Map(), version: 0 };
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
