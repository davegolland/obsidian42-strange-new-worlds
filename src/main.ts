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
import { FeatureManager } from "./FeatureManager";
import { setDiagnosticFlags, log } from "./diag";
import { ImplicitLinksManager } from "./implicit-links";
import { ReferenceCountingPolicy } from "./policies/reference-counting";
import { DEFAULT_SETTINGS, type LegacySettings, type Settings, migrateSettings } from "./settings";
import SnwAPI from "./snwApi";
import PluginCommands from "./ui/PluginCommands";
import { SettingsTab } from "./ui/SettingsTab";
import { SideBarPaneView, VIEW_TYPE_SNW } from "./ui/SideBarPaneView";
import { updateAllSnwLiveUpdateReferencesDebounce, updateHeadersDebounce, updatePropertiesDebounce } from "./ui/debounced-helpers";
import { updateProperties } from "./ui/frontmatterRefCount";
import { updateHeaders } from "./ui/headerRefCount";
import * as uiInits from "./ui/ui-inits";
import { updateAllSnwLiveUpdateReferences } from "./view-extensions/htmlDecorations";
import { BackendClient } from "./backend/client";
import { createBackendLinksProvider } from "./backend/provider";
import { InlineReferenceExtension } from "./view-extensions/references-cm6";

export const UPDATE_DEBOUNCE = 200;

// Type for objects that can be event targets (vault, metadataCache, workspace, etc.)
// Using a more flexible type definition to accommodate Obsidian's API
type EventTargetLike = {
	on(event: string, callback: (...args: any[]) => any, ctx?: any): any;
};

// Configuration for debounced event handlers
interface DebounceEventConfig {
	target: EventTargetLike; // e.g. this.app.vault, this.app.metadataCache
	events: string[]; // names of events to subscribe to
	handler: (...args: any[]) => any; // handler function for these events
	delay: number; // debounce interval in ms
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
	
	// Backend integration
	private _backendClient: BackendClient | null = null;
	private unregisterBackendProvider: (() => void) | null = null;
	private backendProvider: any = null;

	// Public getter for backend client
	get backendClient(): BackendClient | null {
		return this._backendClient;
	}

	// Publicly accessible debounced versions of functions
	updateHeadersDebounced: (() => void) | null = null;
	updatePropertiesDebounced: (() => void) | null = null;
	updateAllSnwLiveUpdateReferencesDebounced: (() => void) | null = null;

	// Collection of all UI initializers
	private getUI_INITIALIZERS(): Array<(plugin: SNWPlugin) => void> {
		const initializers = [
			uiInits.setPluginVariableUIC_RefArea,
			uiInits.setPluginVariableForHtmlDecorations,
			uiInits.setPluginVariableForMarkdownPreviewProcessor,
			uiInits.setPluginVariableForCM6InlineReferences,
			uiInits.initImplicitLinksLivePreview,
			uiInits.setPluginVariableForUIC,
			uiInits.initDebouncedHelpers,
		];

		// Skip non-essential UI components in minimal mode
		if (!this.settings.minimalMode) {
			initializers.push(
				uiInits.setPluginVariableForCM6Gutter,
				uiInits.setPluginVariableForHeaderRefCount,
				uiInits.setPluginVariableForFrontmatterLinksRefCount
			);
		}

		return initializers;
	}

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

	/**
	 * Update diagnostic flags from current settings
	 */
	public updateDiagnosticFlags(): void {
		setDiagnosticFlags(this.settings.dev);
	}

	async onload(): Promise<void> {
		console.log(`loading ${this.appName}`);

		// 1) Always load settings FIRST
		await this.initSettings();
		this.addSettingTab(new SettingsTab(this.app, this));

		// 2) Branch immediately
		if (this.settings.minimalMode) {
			console.log("SNW: 🚀 Minimal Mode (backend-only)");
			// If you need more later, guard with: if (this.settings.dev?.diagDecorations) console.debug(...)
			await this.initAPI({ minimal: true });   // lightweight surface
			await this.initBackend();                // registers backend provider
			await this.initMinimalSurface();         // <— NEW: render inferred links
			console.log("SNW: 🎯 Minimal Mode ready");
			return;
		}

		// 3) Legacy full mode (deprecated)
		if (!this.settings.enableLegacyFullMode) {
			console.log("SNW: ⚠️  LEGACY FULL MODE DISABLED — Switching to minimal mode");
			console.log("SNW: To enable legacy full mode, set enableLegacyFullMode: true in settings");
			this.settings.minimalMode = true;
			await this.saveSettings();
			await this.initAPI({ minimal: true });
			await this.initBackend();
			await this.initMinimalSurface();
			console.log("SNW: 🎯 Switched to minimal mode");
			return;
		}

		console.log("SNW: ⚠️  LEGACY FULL MODE — This mode will be deprecated");
		log.info("🔧 Full mode initialization");

		log.time("buildLinksAndReferences");
		await this.referenceCountingPolicy.buildLinksAndReferences();
		log.timeEnd("buildLinksAndReferences");

		log.time("initUI");
		await this.initUI();
		log.timeEnd("initUI");

		log.time("initAPI");
		await this.initAPI();
		log.timeEnd("initAPI");

		log.time("initViews");
		await this.initViews();
		log.timeEnd("initViews");

		log.time("initDebouncedEvents");
		await this.initDebouncedEvents();
		log.timeEnd("initDebouncedEvents");

		log.time("initCommands");
		await this.initCommands();
		log.timeEnd("initCommands");

		log.time("initFeatureToggles");
		await this.initFeatureToggles();
		log.timeEnd("initFeatureToggles");

		log.time("initLayoutReadyHandler");
		await this.initLayoutReadyHandler();
		log.timeEnd("initLayoutReadyHandler");

		log.time("initBackend");
		await this.initBackend();
		log.timeEnd("initBackend");

		log.timeEnd("onload total");
		log.mark("onload-end");
		log.measure("onload-total", "onload-start", "onload-end");
		log.info("🎯 Full mode initialization complete");
	}

	/**
	 * Initialize all UI components
	 */
	private async initUI(): Promise<void> {
		// Skip in minimal mode
		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping UI component initialization");
			return;
		}
		
		const uiInitializers = this.getUI_INITIALIZERS();
		log.info(`Initializing ${uiInitializers.length} UI components`);
		// Initialize all UI components by calling each initializer
		for (let i = 0; i < uiInitializers.length; i++) {
			const init = uiInitializers[i];
			log.time(`UI.init.${i}`);
			init(this);
			log.timeEnd(`UI.init.${i}`);
		}
	}

	/**
	 * Initialize the API for external access
	 */
	private async initAPI(options?: { minimal?: boolean }): Promise<void> {
		log.time("initAPI");
		window.snwAPI = this.snwAPI; // API access to SNW for Templater, Dataviewjs and the console debugger
		
		if (options?.minimal) {
			// Minimal mode: only expose what's needed for backend provider
			log.info("Minimal mode - lightweight API only");
			// Don't touch reference counts, index, or CM6 extensions
			log.timeEnd("initAPI");
			return;
		}
		
		// Full mode: complete API setup
		log.debug("Full mode - setting up complete API with references");
		this.snwAPI.references = this.referenceCountingPolicy.indexedReferences;
		log.timeEnd("initAPI");
	}

	/**
	 * Initialize and load settings, apply to reference counting policy
	 */
	private async initSettings(): Promise<void> {
		await this.loadSettings();

		// Initialize diagnostic flags
		setDiagnosticFlags(this.settings.dev);

		// set current state based on startup parameters (always needed)
		if (Platform.isMobile || Platform.isMobileApp) {
			this.showCountsActive = this.settings.startup.enableOnMobile;
		} else {
			this.showCountsActive = this.settings.startup.enableOnDesktop;
		}

		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping reference counting and UI setup");
			// Force policy to case-insensitive in minimal mode for stability
			this.settings.wikilinkEquivalencePolicy = "case-insensitive";
			this.referenceCountingPolicy.setActivePolicy("case-insensitive");
			log.info("Minimal mode - policy hard-set to case-insensitive");
			return; // Settings tab added in onload() before this check
		}

		// Full settings initialization (existing code)
		log.debug("Full mode - setting up reference counting policy");
		// Ensure the reference counting policy is using the correct policy from settings
		this.referenceCountingPolicy.setActivePolicy(this.settings.wikilinkEquivalencePolicy);

		// Build synchronously from caller so first render has data
		// await this.referenceCountingPolicy.buildLinksAndReferences();

		// Initialize implicit links manager (only in full mode)
		log.debug("Initializing implicit links manager");
		this.implicitLinksManager = new ImplicitLinksManager(this, this.settings.autoLinks);
		this.implicitLinksManager.registerProvider(this.snwAPI.registerVirtualLinkProvider.bind(this.snwAPI));
	}

	/**
	 * Initialize views and register them
	 */
	private async initViews(): Promise<void> {
		// Skip in minimal mode
		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping views and editor extensions");
			return;
		}

		log.debug("Registering SNW view");
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
		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping debounced event setup");
			return;
		}

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
					// Skip in minimal mode
					if (this.settings.minimalMode) return;
					
					// Full vault rebuild
					this.referenceCountingPolicy.buildLinksAndReferences().catch(console.error);
					updateHeadersDebounce();
					updatePropertiesDebounce();
					updateAllSnwLiveUpdateReferencesDebounce();
					// Trigger implicit links refresh to sync with updated reference counts
					this.implicitLinksManager?.triggerRefresh();
				},
				delay: 3000,
			},
			{
				target: this.app.metadataCache,
				events: ["changed"],
				handler: async (file: TFile, data: string, cache: CachedMetadata) => {
					// Skip in minimal mode
					if (this.settings.minimalMode) return;
					
					// Single file update
					await this.referenceCountingPolicy.removeLinkReferencesForFile(file);
					await this.referenceCountingPolicy.getLinkReferencesForFile(file, cache);
					updateHeadersDebounce();
					updatePropertiesDebounce();
					updateAllSnwLiveUpdateReferencesDebounce();
					// Trigger implicit links refresh to sync with updated reference counts
					this.implicitLinksManager?.triggerRefresh();
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
			},
		]);
	}

	/**
	 * Initialize plugin commands
	 */
	private async initCommands(): Promise<void> {
		// Skip rebuild command in minimal mode
		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping rebuild references command");
			return;
		}

		// Add command to force rebuild of references
		this.addCommand({
			id: "rebuild-references",
			name: "Rebuild all references",
			callback: () => {
				this.rebuildIndex();
			},
		});
	}

	/**
	 * Initialize feature toggles based on settings
	 */
	private async initFeatureToggles(): Promise<void> {
		// Skip in minimal mode
		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping feature toggles");
			return;
		}
		
		// Apply all feature toggles using the feature manager
		this.featureManager.apply();
	}

	/**
	 * Create API bridge to expose getSNWCacheByFile method for decorations/hover
	 */
	private ensureAPIBridge(): void {
		const manager = this.implicitLinksManager;

		// Forwarder used by decorations/hover. If manager isn't ready, return a harmless empty shape.
		const getSNWCacheByFile = (fileOrPath: any) => {
			const fn = manager?.getSNWCacheByFile?.bind(manager);
			return fn ? fn(fileOrPath) : { byPhrase: new Map(), version: 0 };
		};

		// Expose as plugin method (legacy callers use this)
		(this as any).getSNWCacheByFile = getSNWCacheByFile;

		// Also expose on snwAPI if code reads it there
		if (this.snwAPI && !(this.snwAPI as any).getSNWCacheByFile) {
			(this.snwAPI as any).getSNWCacheByFile = getSNWCacheByFile;
		}
	}

	/**
	 * Initialize minimal surface for rendering inferred links
	 */
	private async initMinimalSurface(): Promise<void> {
		// Only the pieces needed to draw inferred links:
		// - implicit links manager (without local detectors / index)
		// - CM6 decorations for inline marks + hover
		// - the backend virtual provider

		// 1) (Re)run the same UI "plugin variable" initializers that full mode uses
		//    Call them here BEFORE registering extensions.
		uiInits.setPluginVariableUIC_RefArea(this);
		uiInits.setPluginVariableForUIC(this);

		// 2) Start the implicit links manager in minimal mode
		this.implicitLinksManager = new ImplicitLinksManager(this, this.settings.autoLinks);
		this.ensureAPIBridge();           // <-- add this line

		// 3) Backend provider already registered in initBackend() - don't duplicate

		// 4) Wire the minimal editor surface (decorations + hover)
		//    Use factory functions that bind plugin instance
		const { inlineDecorationsExtension } = await import("./view-extensions/references-cm6");
		this.registerEditorExtension(inlineDecorationsExtension(this)); // inline decorations
		
		// Import and register the implicit links extension (same as full mode)
		const { createInferredLinksExtension } = await import("./implicit-links/manager");
		const implicitExt = createInferredLinksExtension(this, {
			debounceMs: 120,
			boundaryMode: "word",
			caseInsensitive: true,
			maxPerChunk: 300,
		});
		this.registerEditorExtension(implicitExt);

		console.log("SNW: 🧩 Minimal surface ready (decorations + hover)");
	}

	/**
	 * Initialize backend integration
	 */
	private async initBackend(): Promise<void> {
		// Only initialize backend if it's enabled in settings
		if (!this.settings.backend.enabled) return;
		if (!this._backendClient) {
			this._backendClient = new BackendClient(this.settings.backend.baseUrl);
		}

		// Register backend with the vault path (zero-config)
		const basePath = (this.app.vault.adapter as any).getBasePath?.() ?? "";

		if (!basePath) {
			console.warn("SNW: Cannot get vault base path for backend registration");
			// We can still use /query/related without /register, so ensure provider is up.
			this.refreshBackendProvider();
			return;
		}
		
		try {
			// Use vault name from settings or generate one from path
			const vaultName = this.settings.backend.vaultName || this.app.vault.getName() || "default-vault";

			await this._backendClient.register(vaultName, basePath);
		} catch (error) {
			console.warn("SNW: Backend register failed — check server", error);
			// Continue with provider registration even if register fails
			// The backend might still be available for queries
		}

		// TEMPORARILY DISABLED - Using new candidates endpoint instead
		// this.pollBackendStatus();

		// Register the virtual link provider if enabled
		this.refreshBackendProvider();
	}

	/**
	 * Refresh the backend provider based on current settings
	 */
	refreshBackendProvider(): void {
		// Turn off existing provider
		this.unregisterBackendProvider?.();
		this.unregisterBackendProvider = null;

		if (!this.settings.backend.enabled) return;

		// Initialize backend client if not already done
		if (!this._backendClient) {
			this._backendClient = new BackendClient(this.settings.backend.baseUrl);
		}

		// Register new provider
		if (!this.snwAPI?.registerVirtualLinkProvider) return;
		this.unregisterBackendProvider = createBackendLinksProvider(this.snwAPI, this._backendClient);
	}

	/**
	 * Poll backend status to show readiness
	 */
	private async pollBackendStatus(): Promise<void> {
		if (!this._backendClient) return;
		
		const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
		const maxAttempts = 10;
		let attempts = 0;
		
		while (attempts < maxAttempts) {
			try {
				const status = await this._backendClient.status();
				if (status.ready) {
					new Notice(`SNW: Backend ready (${status.files || 0} files indexed)`);
					return;
				}
				attempts++;
				await delay(2000); // Poll every 2 seconds
			} catch (error) {
				attempts++;
				if (attempts >= maxAttempts) {
					console.warn("SNW: Backend status polling timed out");
					return;
				}
				await delay(2000);
			}
		}
	}

	/**
	 * Initialize handlers that run when the layout is ready
	 */
	private async initLayoutReadyHandler(): Promise<void> {
		if (this.settings.minimalMode) {
			log.info("Minimal mode - skipping layout ready handler setup");
			return;
		}

		log.debug("layout ready handler: setting up");
		this.app.workspace.onLayoutReady(async () => {
			log.debug("layout ready handler: layout ready event fired");
			
			if (!this.app.workspace.getLeavesOfType(VIEW_TYPE_SNW)?.length) {
				await this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_SNW, active: false });
			}
			
			// Skip in minimal mode
			if (this.settings.minimalMode) return;
			
			log.debug("layout ready handler: building index and refreshing UI");
			// Build the index, then proactively refresh all UI so badges appear without edits
			this.referenceCountingPolicy
				.buildLinksAndReferences()
				.then(() => {
					try {
						log.debug("layout ready handler: index built, refreshing UI");
						updateHeadersDebounce();
						updatePropertiesDebounce();
						updateAllSnwLiveUpdateReferencesDebounce(); // also triggers CM6 rescan internally
						// Trigger implicit links refresh to sync with updated reference counts
						this.implicitLinksManager?.triggerRefresh();
						log.debug("layout ready handler: UI refresh complete");
					} catch (e) {
						log.error("post-index UI refresh failed", e);
					}
				})
				.catch((e) => log.error("index build failed", e));
		});

		// When the user switches notes, ensure inline badges render even if nothing changed
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				log.debug("layout ready handler: active-leaf-change event fired");
				try {
					updateAllSnwLiveUpdateReferencesDebounce();
					// Refresh backend provider for new active file
					if (this.settings.backend.enabled) {
						this.refreshBackendProvider();
					}
				} catch (e) {
					log.error("leaf-change refresh failed", e);
				}
			}),
		);
	}

	/**
	 * Force a complete rebuild of the reference index
	 */
	rebuildIndex(): void {
		log.info("rebuildIndex: starting manual rebuild");
		
		// Skip in minimal mode
		if (this.settings.minimalMode) {
			log.warn("rebuildIndex: rebuild disabled in Minimal Mode");
			new Notice("SNW: Rebuild disabled in Minimal Mode");
			return;
		}

		// First toggle debug mode on if it's not already
		if (!this.referenceCountingPolicy.isDebugModeEnabled()) {
			log.debug("rebuildIndex: enabling debug mode");
			this.referenceCountingPolicy.setDebugMode(true);
		}

		// Clear caches
		log.debug("rebuildIndex: clearing caches");
		this.referenceCountingPolicy.invalidateCache();

		// Reset to default policy then back to current to ensure clean state
		const currentPolicy = this.settings.wikilinkEquivalencePolicy;
		log.debug("rebuildIndex: resetting policy", { currentPolicy });
		this.referenceCountingPolicy.setActivePolicy("case-insensitive");
		this.referenceCountingPolicy.setActivePolicy(currentPolicy);

		// Completely rebuild index
		log.debug("rebuildIndex: building links and references");
		this.referenceCountingPolicy.buildLinksAndReferences().catch((e) => log.error("rebuildIndex: build failed", e));

		// Force UI updates using debounced helpers
		log.debug("rebuildIndex: forcing UI updates");
		updateHeadersDebounce();
		updatePropertiesDebounce();
		updateAllSnwLiveUpdateReferencesDebounce();
		// Trigger implicit links refresh to sync with updated reference counts
		this.implicitLinksManager?.triggerRefresh();

		log.info("rebuildIndex: manual rebuild complete");
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
		log.time("settings.load");
		const loadedData = await this.loadData();
		log.debug("settings.load raw:", loadedData);

		// Check if we need to migrate from legacy format
		if (loadedData && "enableOnStartupDesktop" in loadedData) {
			log.info("Migrating settings from legacy format to new format");
			this.settings = migrateSettings(loadedData as unknown as LegacySettings);
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		}

		// Migration: if minimalMode is undefined, set to true (new default)
		if (this.settings.minimalMode === undefined) {
			log.info("Migrating to minimal mode as default");
			this.settings.minimalMode = true;
			await this.saveSettings(); // Save the migration
		}
		
		log.debug("settings.after.migrate:", this.settings);
		log.debug("Settings loaded, minimalMode check:", {
			minimalMode: this.settings.minimalMode,
			settingsSnapshot: JSON.stringify(this.settings)
		});
		log.timeEnd("settings.load");
	}

	async updateSettings(patch: Partial<Settings>): Promise<void> {
		this.settings = { ...this.settings, ...patch };
		await this.saveSettings(); // persist
		
		// If backend toggles changed, re-init provider for current mode
		if (patch?.backend !== undefined || patch?.minimalMode !== undefined) {
			if (this.settings.minimalMode) {
				await this.initBackend();          // ensures backendClient + provider
				// do NOT re-register CM6; initMinimalSurface already did it
			} else {
				await this.refreshBackendProvider();
			}
		}
	}

	async saveSettings(): Promise<void> {
		log.time("settings.save");
		log.debug("settings.save snapshot:", this.settings);
		await this.saveData(this.settings);
		log.timeEnd("settings.save");
		
		// Update the feature manager with the new settings
		this.featureManager.updateSettings(this.settings);
		// Update the implicit links manager with the new settings
		if (this.implicitLinksManager) {
			await this.implicitLinksManager.updateSettings(this.settings.autoLinks);
		}
		
		// Refresh backend provider if backend settings changed
		const oldBackendEnabled = this._backendClient ? true : false;
		const newBackendEnabled = this.settings.backend.enabled;
		
		if (newBackendEnabled && (!this._backendClient || this._backendClient.getBaseUrl() !== this.settings.backend.baseUrl)) {
			// Backend enabled or URL changed - reinitialize
			this._backendClient = null; // force re-create with new URL
			await this.initBackend();
		} else if (!newBackendEnabled && oldBackendEnabled) {
			// Backend disabled - clean up
			this.unregisterBackendProvider?.();
			this.unregisterBackendProvider = null;
			this._backendClient = null;
		} else if (newBackendEnabled) {
			// Just refresh the provider
			this.refreshBackendProvider();
		}
	}

	onunload(): void {
		log.info(`unloading ${this.appName}`);
		try {
			// Unload all features using the feature manager
			this.featureManager.unloadAll();

			// Unload implicit links manager
			if (this.implicitLinksManager) {
				this.implicitLinksManager.unload();
			}

			// Unload backend provider
			this.unregisterBackendProvider?.();

			this.app.workspace.unregisterHoverLinkSource(this.appID);
		} catch (error) {
			log.error("unload error", error);
		}
	}
}
