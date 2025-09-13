import { Plugin } from "obsidian";
import { ImplicitLinksManager } from "./implicit-links/ImplicitLinksManager";
import { DEFAULT_SETTINGS, type Settings, loadSettings, saveSettings } from "./settings";
import SnwAPI from "./snwApi";
import { SettingsTab } from "./ui/SettingsTab";
import * as uiInits from "./ui/ui-inits";
import { BackendClient } from "./backend/client";
import { createBackendLinksProvider } from "./backend/provider";
import { ReferenceCountingPolicy } from "./policies/reference-counting";


export default class SNWPlugin extends Plugin {
	appName = this.manifest.name;
	appID = this.manifest.id;
	APP_ABBREVIARTION = "SNW";
	settings: Settings = DEFAULT_SETTINGS;
	snwAPI: SnwAPI = new SnwAPI(this);
	implicitLinksManager!: ImplicitLinksManager;
	referenceCountingPolicy!: ReferenceCountingPolicy;
	
	// Backend integration
	private _backendClient: BackendClient | null = null;
	private unregisterBackendProvider: (() => void) | null = null;

	// Public getter for backend client
	get backendClient(): BackendClient | null {
		return this._backendClient;
	}




	async onload(): Promise<void> {
		// 1) Always load settings FIRST
		await this.initSettings();
		this.addSettingTab(new SettingsTab(this.app, this));

		// 2) Minimal mode only
		console.log("SNW: 🚀 Minimal Mode (backend-only)");
		
		// 3) Construct API & policy up front (order matters)
		await this.initAPI({ minimal: true });   // lightweight surface
		this.referenceCountingPolicy = new ReferenceCountingPolicy(this);

		// 4) Backend client init & registration
		await this.initBackend();                // registers backend provider


		// 7) Initialize minimal surface for rendering
		await this.initMinimalSurface();         // render inferred links
	}


	/**
	 * Initialize the API for external access
	 */
	private async initAPI(options?: { minimal?: boolean }): Promise<void> {
		// Hard guarantee: create snwAPI if it doesn't exist
		if (!this.snwAPI) this.snwAPI = new SnwAPI(this);
		(window as any).snwAPI = this.snwAPI;
	}

	/**
	 * Initialize and load settings
	 */
	private async initSettings(): Promise<void> {
		await this.loadSettings();
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
		uiInits.setPluginVariableForCM6InlineReferences?.(this);
		uiInits.setPluginVariableForHtmlDecorations(this);  // ← critical: powers tippy hover

		// 2) Start the implicit links manager in minimal mode
		this.implicitLinksManager = new ImplicitLinksManager(this, {
			enabledLivePreview: false,
			enabledReadingView: false,
			detectionMode: "off",
			regexRules: [],
			dictionary: {
				sources: { basenames: true, aliases: true, headings: false, customList: false },
				minPhraseLength: 3,
				requireWordBoundaries: true,
				customPhrases: [],
			},
		});

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

		// 5) Initialize implicit links Live Preview (creates the numbered badges)
		// (removed: no-op in minimal mode)

		// 6) Trigger refresh when switching files for better responsiveness
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.implicitLinksManager?.triggerRefresh?.();
			})
		);
	}

	/**
	 * Initialize backend integration
	 */
	private async initBackend(): Promise<void> {
		const url = (this.settings.backendUrl || "").trim();
		if (!url) {
			console.warn("SNW: backend URL not set; skipping initBackend");
			return;
		}

		// (Re)create client if needed or if URL changed
		if (!this._backendClient || this._backendClient.getBaseUrl() !== url) {
			this._backendClient = new BackendClient(url);
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
			const vaultName = this.app.vault.getName() || "default-vault";

			await this._backendClient.register(vaultName, basePath);
			console.log("SNW: HTTP POST {base}/register");
		} catch (error) {
			console.warn("SNW: Backend register failed — check server", error);
			// Continue with provider registration even if register fails
			// The backend might still be available for queries
		}

		// Register the virtual link provider
		this.refreshBackendProvider();
	}

	/**
	 * Refresh the backend provider based on current settings
	 */
	private refreshBackendProvider(): void {
		if (!this._backendClient) return;

		// Unregister old
		this.unregisterBackendProvider?.();
		this.unregisterBackendProvider = null;

		// Guard: api ready?
		if (!this.snwAPI || !(this.snwAPI as any).registerVirtualLinkProvider) {
			console.warn("SNW: snwAPI not ready; will try again soon");
			return;
		}

		this.unregisterBackendProvider = createBackendLinksProvider(
			this.snwAPI,
			this._backendClient
		);
		console.log("SNW: backend virtual provider registered");
	}





	async loadSettings(): Promise<void> {
		await loadSettings(this);
	}

	async updateSettings(patch: Partial<Settings>): Promise<void> {
		this.settings = { ...this.settings, ...patch };
		await this.saveSettings(); // persist
		
		// If backend URL changed, re-init provider
		if (patch?.backendUrl !== undefined) {
			await this.initBackend();
		}
	}

	async saveSettings(): Promise<void> {
		await saveSettings(this);
	}

	onunload(): void {
		try {
			// Unload implicit links manager
			if (this.implicitLinksManager) {
				this.implicitLinksManager.unload();
			}

			// Unload backend provider
			this.unregisterBackendProvider?.();

			this.app.workspace.unregisterHoverLinkSource(this.appID);
		} catch (error) {
			console.error("unload error", error);
		}
	}
}
