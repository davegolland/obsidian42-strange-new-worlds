import type { Extension } from "@codemirror/state";
import {
	type CachedMetadata,
	type MarkdownPostProcessor,
	MarkdownPreviewRenderer,
	Notice,
	Platform,
	Plugin,
	type TFile,
	type WorkspaceLeaf,
	debounce,
} from "obsidian";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import SnwAPI from "./snwApi";
import { ReferenceCountingPolicy } from "./policies/reference-counting";
import PluginCommands from "./ui/PluginCommands";
import { SettingsTab } from "./ui/SettingsTab";
import { SideBarPaneView, VIEW_TYPE_SNW } from "./ui/SideBarPaneView";
import * as uiInits from "./ui/ui-inits";
import { updateProperties } from "./ui/frontmatterRefCount";
import { updateHeaders } from "./ui/headerRefCount";
import {
	updateHeadersDebounce,
	updatePropertiesDebounce,
	updateAllSnwLiveUpdateReferencesDebounce
} from "./ui/debounced-helpers";
import ReferenceGutterExtension from "./view-extensions/gutters-cm6";
import { updateAllSnwLiveUpdateReferences } from "./view-extensions/htmlDecorations";
import { InlineReferenceExtension } from "./view-extensions/references-cm6";
import markdownPreviewProcessor from "./view-extensions/references-preview";

export const UPDATE_DEBOUNCE = 200;

// Define a Feature interface for toggling features
interface Feature {
	key: keyof Settings;            // which settings flag to check
	register: () => void;           // how to turn it ON
	unregister: () => void;         // how to turn it OFF
	additionalCheck?: () => boolean; // optional additional condition
}

// Type for objects that can be event targets (vault, metadataCache, workspace, etc.)
// Using a more flexible type definition to accommodate Obsidian's API
type EventTargetLike = {
	on(event: string, callback: (...args: any[]) => any, ctx?: any): any;
};

// Configuration for debounced event handlers
interface DebounceEventConfig {
	target: EventTargetLike;         // e.g. this.app.vault, this.app.metadataCache
	events: string[];                // names of events to subscribe to
	handler: (...args: any[]) => any; // handler function for these events
	delay: number;                   // debounce interval in ms
}

export default class SNWPlugin extends Plugin {
	appName = this.manifest.name;
	appID = this.manifest.id;
	APP_ABBREVIARTION = "SNW";
	settings: Settings = DEFAULT_SETTINGS;
	//controls global state if the plugin is showing counters
	showCountsActive: boolean = DEFAULT_SETTINGS.enableOnStartupDesktop;
	lastSelectedReferenceType = "";
	lastSelectedReferenceRealLink = "";
	lastSelectedReferenceKey = "";
	lastSelectedReferenceFilePath = "";
	lastSelectedLineNumber = 0;
	snwAPI: SnwAPI = new SnwAPI(this);
	markdownPostProcessor: MarkdownPostProcessor | null = null;
	editorExtensions: Extension[] = [];
	commands: PluginCommands = new PluginCommands(this);
	referenceCountingPolicy: ReferenceCountingPolicy = new ReferenceCountingPolicy(this);
	
	// Publicly accessible debounced versions of functions
	updateHeadersDebounced: (() => void) | null = null;
	updatePropertiesDebounced: (() => void) | null = null;
	updateAllSnwLiveUpdateReferencesDebounced: (() => void) | null = null;

	// Collection of all UI initializers
	private UI_INITIALIZERS: Array<(plugin: SNWPlugin) => void> = [
		uiInits.setPluginVariableUIC_RefArea,
		uiInits.setPluginVariableForHtmlDecorations,
		uiInits.setPluginVariableForCM6Gutter,
		uiInits.setPluginVariableForHeaderRefCount,
		uiInits.setPluginVariableForFrontmatterLinksRefCount,
		uiInits.setPluginVariableForMarkdownPreviewProcessor,
		uiInits.setPluginVariableForCM6InlineReferences,
		uiInits.setPluginVariableForUIC,
		uiInits.initDebouncedHelpers,
	];
	
	// Collection of all features that can be toggled
	private features: Feature[] = [
		{
			key: "displayInlineReferencesMarkdown",
			register: () => {
				this.markdownPostProcessor = this.registerMarkdownPostProcessor(
					(el, ctx) => markdownPreviewProcessor(el, ctx), 100
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

	/**
	 * Helper to wire up multiple debounced event handlers in a DRY way
	 */
	private wireDebouncedEvents(configs: DebounceEventConfig[]) {
		for (const { target, events, handler, delay } of configs) {
			// Bind `this` so handler can refer to plugin state
			const debounced = debounce(handler.bind(this), delay, true);
			// Register each event name on its target
			for (const evt of events) {
				// registerEvent ensures the plugin will auto-unregister on unload
				this.registerEvent(target.on(evt, debounced));
			}
		}
	}

	async onload(): Promise<void> {
		console.log(`loading ${this.appName}`);
		
		await this.initUI();
		await this.initAPI();
		await this.initSettings();
		await this.initViews();
		await this.initDebouncedEvents();
		await this.initCommands();
		await this.initFeatureToggles();
		await this.initLayoutReadyHandler();
	}

	/**
	 * Initialize all UI components
	 */
	private async initUI(): Promise<void> {
		// Initialize all UI components by calling each initializer
		for (const init of this.UI_INITIALIZERS) {
			init(this);
		}
	}

	/**
	 * Initialize the API for external access
	 */
	private async initAPI(): Promise<void> {
		window.snwAPI = this.snwAPI; // API access to SNW for Templater, Dataviewjs and the console debugger
		this.snwAPI.references = this.referenceCountingPolicy.indexedReferences;
		
		// Will be set after settings are loaded
		// @ts-ignore
		this.snwAPI.settings = this.settings;
	}

	/**
	 * Initialize and load settings, apply to reference counting policy
	 */
	private async initSettings(): Promise<void> {
		await this.loadSettings();
		
		// Ensure the reference counting policy is using the correct policy from settings
		this.referenceCountingPolicy.setActivePolicy(this.settings.wikilinkEquivalencePolicy);
		
		// Force a rebuild of all references with the correct policy
		this.referenceCountingPolicy.buildLinksAndReferences();
		
		this.addSettingTab(new SettingsTab(this.app, this));

		// set current state based on startup parameters
		if (Platform.isMobile || Platform.isMobileApp) {
			this.showCountsActive = this.settings.enableOnStartupMobile;
		} else {
			this.showCountsActive = this.settings.enableOnStartupDesktop;
		}
	}

	/**
	 * Initialize views and register them
	 */
	private async initViews(): Promise<void> {
		this.registerView(VIEW_TYPE_SNW, (leaf) => new SideBarPaneView(leaf, this));
		
		this.app.workspace.registerHoverLinkSource(this.appID, {
			display: this.appName,
			defaultMod: true,
		});
		
		this.registerEditorExtension(this.editorExtensions);
	}

	/**
	 * Initialize all debounced event handlers
	 */
	private async initDebouncedEvents(): Promise<void> {
		// Create debounced versions of our update functions for external use
		this.updateHeadersDebounced = debounce(updateHeaders, UPDATE_DEBOUNCE, true);
		this.updatePropertiesDebounced = debounce(updateProperties, UPDATE_DEBOUNCE, true);
		this.updateAllSnwLiveUpdateReferencesDebounced = debounce(updateAllSnwLiveUpdateReferences, UPDATE_DEBOUNCE, true);

		// Set up all debounced event handlers with a single helper
		this.wireDebouncedEvents([
			{
				target: this.app.vault,
				events: ["rename", "delete"],
				handler: () => {
					// Full vault rebuild
					this.referenceCountingPolicy.buildLinksAndReferences();
					updateHeadersDebounce();
					updatePropertiesDebounce();
					updateAllSnwLiveUpdateReferencesDebounce();
				},
				delay: 3000,
			},
			{
				target: this.app.metadataCache,
				events: ["changed"],
				handler: async (file: TFile, data: string, cache: CachedMetadata) => {
					// Single file update
					await this.referenceCountingPolicy.removeLinkReferencesForFile(file);
					this.referenceCountingPolicy.getLinkReferencesForFile(file, cache);
					updateHeadersDebounce();
					updatePropertiesDebounce();
					updateAllSnwLiveUpdateReferencesDebounce();
				},
				delay: 1000,
			},
			{
				target: this.app.workspace,
				events: ["layout-change"],
				handler: () => {
					// UI header/property refresh
					updateHeadersDebounce();
					updatePropertiesDebounce();
				},
				delay: UPDATE_DEBOUNCE,
			}
		]);
	}

	/**
	 * Initialize plugin commands
	 */
	private async initCommands(): Promise<void> {
		// Add command to force rebuild of references
		this.addCommand({
			id: "rebuild-references",
			name: "Rebuild all references",
			callback: () => {
				this.rebuildIndex();
			}
		});
	}

	/**
	 * Initialize feature toggles based on settings
	 */
	private async initFeatureToggles(): Promise<void> {
		// Initial feature toggles
		for (const feature of this.features) {
			this.toggleFeature(feature);
		}
	}

	/**
	 * Initialize handlers that run when the layout is ready
	 */
	private async initLayoutReadyHandler(): Promise<void> {
		this.app.workspace.onLayoutReady(async () => {
			if (!this.app.workspace.getLeavesOfType(VIEW_TYPE_SNW)?.length) {
				await this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_SNW, active: false });
			}
			this.referenceCountingPolicy.buildLinksAndReferences();
		});
	}

	/**
	 * Generic helper method to toggle a feature on or off based on settings and state
	 */
	private toggleFeature(feature: Feature) {
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
	 * Force a complete rebuild of the reference index
	 */
	rebuildIndex(): void {
		// First toggle debug mode on if it's not already
		if (!this.referenceCountingPolicy.isDebugModeEnabled()) {
			this.referenceCountingPolicy.setDebugMode(true);
		}
		
		// Clear caches
		this.referenceCountingPolicy.invalidateCache();
		
		// Reset to default policy then back to current to ensure clean state
		const currentPolicy = this.settings.wikilinkEquivalencePolicy;
		this.referenceCountingPolicy.setActivePolicy("case-insensitive");
		this.referenceCountingPolicy.setActivePolicy(currentPolicy);
		
		// Completely rebuild index
		this.referenceCountingPolicy.buildLinksAndReferences();
		
		// Force UI updates using debounced helpers
		updateHeadersDebounce();
		updatePropertiesDebounce();
		updateAllSnwLiveUpdateReferencesDebounce();
		
		// Show notice
		new Notice("SNW: References rebuilt successfully");
	}

	// Displays the sidebar SNW pane
	async activateView(refType: string, realLink: string, key: string, filePath: string, lineNu: number) {
		this.lastSelectedReferenceType = refType;
		this.lastSelectedReferenceRealLink = realLink;
		this.lastSelectedReferenceKey = key;
		this.lastSelectedReferenceFilePath = filePath;
		this.lastSelectedLineNumber = lineNu;

		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_SNW);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			const leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_SNW, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) workspace.revealLeaf(leaf);
		await (this.app.workspace.getLeavesOfType(VIEW_TYPE_SNW)[0].view as SideBarPaneView).updateView();
	}

	// Legacy toggle methods that now use the DRY approach of toggleFeature
	toggleStateSNWMarkdownPreview(): void {
		this.toggleFeature(this.features[0]); // Markdown Preview feature
	}

	toggleStateSNWLivePreview(): void {
		this.toggleFeature(this.features[1]); // Live Preview feature
	}

	toggleStateSNWGutters(): void {
		this.toggleFeature(this.features[2]); // Gutters feature
	}

	// Manages which CM extensions are loaded into Obsidian
	updateCMExtensionState(extensionIdentifier: string, extensionState: boolean, extension: Extension) {
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
		this.app.workspace.updateOptions();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onunload(): void {
		console.log(`unloading ${this.appName}`);
		try {
			if (!this.markdownPostProcessor) {
				console.log("Markdown post processor is not registered");
			} else {
				MarkdownPreviewRenderer.unregisterPostProcessor(this.markdownPostProcessor);
			}
			this.app.workspace.unregisterHoverLinkSource(this.appID);
		} catch (error) {
			/* don't do anything */
		}
	}
}
