import { MarkdownPostProcessor, MarkdownPreviewRenderer, Platform } from "obsidian";
import type { Extension } from "@codemirror/state";
import { Settings } from "./settings";
import markdownPreviewProcessor from "./view-extensions/references-preview";
import { InlineReferenceExtension } from "./view-extensions/references-cm6";
import ReferenceGutterExtension from "./view-extensions/gutters-cm6";

// Define a Feature interface for toggling features
export interface Feature {
    key: keyof Settings;            // which settings flag to check
    register: () => void;           // how to turn it ON
    unregister: () => void;         // how to turn it OFF
    additionalCheck?: () => boolean; // optional additional condition
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
        private showCountsActive: boolean = true
    ) {
        this.initFeatures();
    }
    
    /**
     * Initialize the features array with all supported features
     */
    private initFeatures(): void {
        this.features = [
            {
                key: "displayInlineReferencesMarkdown",
                register: () => {
                    this.markdownPostProcessor = this.plugin.registerMarkdownPostProcessor(
                        (el: HTMLElement, ctx: any) => markdownPreviewProcessor(el, ctx), 100
                    );
                },
                unregister: () => {
                    if (this.markdownPostProcessor) {
                        MarkdownPreviewRenderer.unregisterPostProcessor(this.markdownPostProcessor);
                        this.markdownPostProcessor = null;
                    }
                }
            },
            {
                key: "displayInlineReferencesLivePreview",
                register: () => this.updateCMExtensionState("inline-ref", true, InlineReferenceExtension),
                unregister: () => this.updateCMExtensionState("inline-ref", false, InlineReferenceExtension)
            },
            {
                key: "displayEmbedReferencesInGutter",
                register: () => this.updateCMExtensionState("gutter", true, ReferenceGutterExtension),
                unregister: () => this.updateCMExtensionState("gutter", false, ReferenceGutterExtension),
                additionalCheck: () => {
                    return Platform.isMobile || Platform.isMobileApp 
                        ? this.settings.displayEmbedReferencesInGutterMobile
                        : true;
                }
            }
        ];
    }
    
    /**
     * Apply all feature toggles based on current settings and showCountsActive state
     */
    public apply(): void {
        for (const feature of this.features) {
            this.toggleFeature(feature);
        }
    }
    
    /**
     * Update settings reference and reapply feature toggles
     */
    public updateSettings(settings: Settings): void {
        this.settings = settings;
        this.apply();
    }
    
    /**
     * Update showCountsActive state and reapply feature toggles
     */
    public updateShowCountsActive(showCountsActive: boolean): void {
        this.showCountsActive = showCountsActive;
        this.apply();
    }
    
    /**
     * Toggle a specific feature by key
     */
    public toggleFeatureByKey(key: keyof Settings): void {
        const feature = this.features.find(f => f.key === key);
        if (feature) {
            this.toggleFeature(feature);
        }
    }
    
    /**
     * Generic helper method to toggle a feature on or off based on settings and state
     */
    private toggleFeature(feature: Feature): void {
        let enabled = Boolean(this.settings[feature.key]) && this.showCountsActive;
        
        // Check additional condition if it exists
        if (feature.additionalCheck && enabled) {
            enabled = feature.additionalCheck();
        }
        
        if (enabled) {
            feature.register();
        } else {
            feature.unregister();
        }
    }
    
    /**
     * Manages which CM extensions are loaded into Obsidian
     */
    private updateCMExtensionState(extensionIdentifier: string, extensionState: boolean, extension: Extension): void {
        if (extensionState === true) {
            this.editorExtensions.push(extension);
            // @ts-ignore
            this.editorExtensions[this.editorExtensions.length - 1].snwID = extensionIdentifier;
        } else {
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
        this.toggleFeature(this.features[0]);
    }
    
    public toggleLivePreview(): void {
        this.toggleFeature(this.features[1]);
    }
    
    public toggleGutters(): void {
        this.toggleFeature(this.features[2]);
    }
    
    /**
     * Clean up and unregister all features
     */
    public unloadAll(): void {
        for (const feature of this.features) {
            feature.unregister();
        }
    }
} 