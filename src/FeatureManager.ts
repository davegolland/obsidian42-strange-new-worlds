import type { Extension } from "@codemirror/state";
import { type MarkdownPostProcessor, MarkdownPreviewRenderer, Platform } from "obsidian";
import type { Settings } from "./settings";
import ReferenceGutterExtension from "./view-extensions/gutters-cm6";
import { InlineReferenceExtension } from "./view-extensions/references-cm6";
import markdownPreviewProcessor from "./view-extensions/references-preview";
import { log } from "./diag";
// Implicit links are now handled by the virtual-badges system in main.ts

// Define a Feature interface for toggling features
export interface Feature {
	name: string; // Descriptive name for the feature
	check: (settings: Settings) => boolean; // Function to check if feature is enabled in settings
	register: () => void; // How to turn it ON
	unregister: () => void; // How to turn it OFF
}

/**
 * FeatureManager handles registration and unregistration of features
 * based on plugin settings and the global show counts state.
 */
export class FeatureManager {
	private features: Feature[] = [];
	private editorExtensions: Extension[] = [];
	private markdownPostProcessor: MarkdownPostProcessor | null = null;

	constructor(
		private plugin: any, // Reference to the plugin instance
		private settings: Settings,
		private showCountsActive = true,
	) {
		log.debug("FeatureManager: initializing");
		this.initFeatures();
		log.debug("FeatureManager: initialization complete");
	}

	/**
	 * Initialize the features array with all supported features
	 */
	private initFeatures(): void {
		this.features = [
			{
				name: "markdownPreview",
				check: (settings: Settings) => settings.display.inlineReferencesMarkdown,
				register: () => {
					this.markdownPostProcessor = this.plugin.registerMarkdownPostProcessor(
						(el: HTMLElement, ctx: any) => markdownPreviewProcessor(el, ctx),
						100,
					);
				},
				unregister: () => {
					if (this.markdownPostProcessor) {
						MarkdownPreviewRenderer.unregisterPostProcessor(this.markdownPostProcessor);
						this.markdownPostProcessor = null;
					}
				},
			},
			{
				name: "livePreview",
				check: (settings: Settings) => settings.display.inlineReferencesLivePreview,
				register: () => this.updateCMExtensionState("inline-ref", true, InlineReferenceExtension),
				unregister: () => this.updateCMExtensionState("inline-ref", false, InlineReferenceExtension),
			},
			{
				name: "gutter",
				check: (settings: Settings) => {
					return Platform.isMobile || Platform.isMobileApp ? settings.embed.referencesInGutterMobile : settings.embed.referencesInGutter;
				},
				register: () => this.updateCMExtensionState("gutter", true, ReferenceGutterExtension),
				unregister: () => this.updateCMExtensionState("gutter", false, ReferenceGutterExtension),
			},
			// Implicit links are now handled by the virtual-badges system in main.ts
			// No longer managed as a feature here
		];
	}

	/**
	 * Apply all feature toggles based on current settings and showCountsActive state
	 */
	public apply(): void {
		log.debug("FeatureManager: applying feature toggles");
		for (const feature of this.features) {
			this.toggleFeature(feature);
		}
		log.debug("FeatureManager: feature toggles applied");
	}

	/**
	 * Update settings reference and reapply feature toggles
	 */
	public updateSettings(settings: Settings): void {
		log.debug("FeatureManager: updating settings");
		this.settings = settings;
		this.apply();
	}

	/**
	 * Update showCountsActive state and reapply feature toggles
	 */
	public updateShowCountsActive(showCountsActive: boolean): void {
		log.debug("FeatureManager: updating showCountsActive", { showCountsActive });
		this.showCountsActive = showCountsActive;
		this.apply();
	}

	/**
	 * Toggle a specific feature by name
	 */
	public toggleFeatureByName(name: string): void {
		const feature = this.features.find((f) => f.name === name);
		if (feature) {
			this.toggleFeature(feature);
		}
	}

	/**
	 * Generic helper method to toggle a feature on or off based on settings and state
	 */
	private toggleFeature(feature: Feature): void {
		const enabled = feature.check(this.settings) && this.showCountsActive;
		log.debug(`FeatureManager: toggling ${feature.name}`, { enabled, showCountsActive: this.showCountsActive });

		if (enabled) {
			log.debug(`FeatureManager: registering ${feature.name}`);
			feature.register();
		} else {
			log.debug(`FeatureManager: unregistering ${feature.name}`);
			feature.unregister();
		}
	}

	/**
	 * Manages which CM extensions are loaded into Obsidian
	 */
	private updateCMExtensionState(extensionIdentifier: string, extensionState: boolean, extension: Extension): void {
		log.debug(`FeatureManager: updating CM extension state`, { extensionIdentifier, extensionState });
		
		if (extensionState === true) {
			log.debug(`FeatureManager: adding CM extension ${extensionIdentifier}`);
			this.editorExtensions.push(extension);
			// @ts-ignore
			this.editorExtensions[this.editorExtensions.length - 1].snwID = extensionIdentifier;
		} else {
			log.debug(`FeatureManager: removing CM extension ${extensionIdentifier}`);
			for (let i = 0; i < this.editorExtensions.length; i++) {
				const ext = this.editorExtensions[i];
				// @ts-ignore
				if (ext.snwID === extensionIdentifier) {
					this.editorExtensions.splice(i, 1);
					break;
				}
			}
		}
		this.plugin.app.workspace.updateOptions();
	}

	/**
	 * Get the array of editor extensions
	 */
	public getEditorExtensions(): Extension[] {
		return this.editorExtensions;
	}

	/**
	 * Get the markdown post processor
	 */
	public getMarkdownPostProcessor(): MarkdownPostProcessor | null {
		return this.markdownPostProcessor;
	}

	// Legacy toggle methods
	public toggleMarkdownPreview(): void {
		this.toggleFeatureByName("markdownPreview");
	}

	public toggleLivePreview(): void {
		this.toggleFeatureByName("livePreview");
	}

	public toggleGutters(): void {
		this.toggleFeatureByName("gutter");
	}

	/**
	 * Clean up and unregister all features
	 */
	public unloadAll(): void {
		log.debug("FeatureManager: unloading all features");
		for (const feature of this.features) {
			feature.unregister();
		}
	}
}
