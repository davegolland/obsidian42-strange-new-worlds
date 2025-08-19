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
import { DEFAULT_SETTINGS, type Settings, type LegacySettings, migrateSettings } from "./settings";
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
import { updateAllSnwLiveUpdateReferences } from "./view-extensions/htmlDecorations";
import { FeatureManager } from "./FeatureManager";
import { ImplicitLinksManager } from "./implicit-links";

export const UPDATE_DEBOUNCE = 200;

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
	showCountsActive: boolean = DEFAULT_SETTINGS.startup.enableOnDesktop;
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
	featureManager!: FeatureManager;
	implicitLinksManager!: ImplicitLinksManager;
	
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
		uiInits.initImplicitLinksLivePreview,
		uiInits.setPluginVariableForUIC,
		uiInits.initDebouncedHelpers,
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
		
		// Initialize feature manager
		this.featureManager = new FeatureManager(this, this.settings, this.showCountsActive);
		
		// 1) Load settings and build the index FIRST so UI has data on first paint
		await this.initSettings();
		await this.referenceCountingPolicy.buildLinksAndReferences();
		// 2) Now wire up UI/view extensions
		await this.initUI();
		await this.initAPI();
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
		
		// Build synchronously from caller so first render has data
		// await this.referenceCountingPolicy.buildLinksAndReferences();
		
		this.addSettingTab(new SettingsTab(this.app, this));

		// set current state based on startup parameters
		if (Platform.isMobile || Platform.isMobileApp) {
			this.showCountsActive = this.settings.startup.enableOnMobile;
		} else {
			this.showCountsActive = this.settings.startup.enableOnDesktop;
		}
		
		// Update feature manager with current settings and state
		this.featureManager.updateSettings(this.settings);
		this.featureManager.updateShowCountsActive(this.showCountsActive);
		
		// Initialize implicit links manager
		this.implicitLinksManager = new ImplicitLinksManager(this, this.settings.autoLinks);
		this.implicitLinksManager.registerProvider(this.snwAPI.registerVirtualLinkProvider.bind(this.snwAPI));
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
		
		// Get editor extensions from feature manager
		this.editorExtensions = this.featureManager.getEditorExtensions();
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
					this.referenceCountingPolicy.buildLinksAndReferences().catch(console.error);
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
					await this.referenceCountingPolicy.getLinkReferencesForFile(file, cache);
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
		// Apply all feature toggles using the feature manager
		this.featureManager.apply();
	}

	/**
	 * Initialize handlers that run when the layout is ready
	 */
	private async initLayoutReadyHandler(): Promise<void> {
		this.app.workspace.onLayoutReady(async () => {
			if (!this.app.workspace.getLeavesOfType(VIEW_TYPE_SNW)?.length) {
				await this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_SNW, active: false });
			}
			// Build the index, then proactively refresh all UI so badges appear without edits
			this.referenceCountingPolicy.buildLinksAndReferences()
				.then(() => {
					try {
						updateHeadersDebounce();
						updatePropertiesDebounce();
						updateAllSnwLiveUpdateReferencesDebounce(); // also triggers CM6 rescan internally
					} catch (e) {
						console.error("SNW: post-index UI refresh failed", e);
					}
				})
				.catch(console.error);
		});

		// When the user switches notes, ensure inline badges render even if nothing changed
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				try {
					updateAllSnwLiveUpdateReferencesDebounce();
				} catch (e) {
					console.error("SNW: leaf-change refresh failed", e);
				}
			})
		);
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
		this.referenceCountingPolicy.buildLinksAndReferences().catch(console.error);
		
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

	// Legacy toggle methods that now use the FeatureManager
	toggleStateSNWMarkdownPreview(): void {
		this.featureManager.toggleMarkdownPreview();
	}

	toggleStateSNWLivePreview(): void {
		this.featureManager.toggleLivePreview();
	}

	toggleStateSNWGutters(): void {
		this.featureManager.toggleGutters();
	}

	// This method is now handled by the feature manager
	// Keeping the method signature to maintain backward compatibility
	updateCMExtensionState(extensionIdentifier: string, extensionState: boolean, extension: Extension) {
		// This is just a pointer to methods in FeatureManager,
		// actual implementation moved to the FeatureManager class
	}

	async loadSettings(): Promise<void> {
		const loadedData = await this.loadData();
		
		// Check if we need to migrate from legacy format
		if (loadedData && 'enableOnStartupDesktop' in loadedData) {
			console.log(`${this.appName}: Migrating settings from legacy format to new format`);
			this.settings = migrateSettings(loadedData as unknown as LegacySettings);
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Update the feature manager with the new settings
		this.featureManager.updateSettings(this.settings);
		// Update the implicit links manager with the new settings
		if (this.implicitLinksManager) {
			await this.implicitLinksManager.updateSettings(this.settings.autoLinks);
		}
	}

	onunload(): void {
		console.log(`unloading ${this.appName}`);
		try {
			// Unload all features using the feature manager
			this.featureManager.unloadAll();
			
			// Unload implicit links manager
			if (this.implicitLinksManager) {
				this.implicitLinksManager.unload();
			}
			
			this.app.workspace.unregisterHoverLinkSource(this.appID);
		} catch (error) {
			/* don't do anything */
		}
	}
}
