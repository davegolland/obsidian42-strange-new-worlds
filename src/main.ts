import { Plugin } from "obsidian";
import { ImplicitLinksManager } from "./implicit-links/ImplicitLinksManager";
import { DEFAULT_SETTINGS, type Settings, loadSettings, saveSettings } from "./settings";
import InferredWikilinksAPI from "./inferredWikilinksApi";
import { SettingsTab } from "./ui/SettingsTab";
import * as uiInits from "./ui/ui-inits";
import { BackendClient } from "./backend/client";
import { createBackendLinksProvider } from "./backend/provider";
import { ReferenceCountingPolicy } from "./policies/reference-counting";
import { log } from "./diag";


export default class InferredWikilinksPlugin extends Plugin {
	appName = this.manifest.name;
	appID = this.manifest.id;
	APP_ABBREVIATION = "IW";
	settings: Settings = DEFAULT_SETTINGS;
	inferredWikilinksAPI: InferredWikilinksAPI = new InferredWikilinksAPI(this);
	implicitLinksManager!: ImplicitLinksManager;
	referenceCountingPolicy!: ReferenceCountingPolicy;
	
	// Backend integration
	private _backendClient: BackendClient | null = null;
	private unregisterBackendProvider: (() => void) | null = null;

	// Public getter for backend client
	get backendClient(): BackendClient | null {
		return this._backendClient;
	}

	private backendCapabilities: Set<string> = new Set();
	private hasLoggedSnwAvailability = false;

	supportsSnwSnippets(): boolean {
		return this.backendCapabilities.has("snippets:snw-text");
	}

	async onload(): Promise<void> {
		await this.initSettings();
		this.addSettingTab(new SettingsTab(this.app, this));
		await this.initAPI();
		this.referenceCountingPolicy = new ReferenceCountingPolicy(this);
		await this.initBackend();
		await this.initMinimalSurface();
	}


	/**
	 * Initialize the API for external access
	 */
	private async initAPI(): Promise<void> {
		this.inferredWikilinksAPI ??= new InferredWikilinksAPI(this);
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
		//    Use factory function to separate extension logic from boot logic
		const { registerInlineAndImplicit } = await import("./view-extensions/register");
		await registerInlineAndImplicit(this);

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
	 * This is the ONLY place where backend registration happens
	 */
	private async initBackend(): Promise<void> {
		const url = (this.settings.backendUrl || "").trim();
		if (!url) {
			log.warn("backend URL not set; skipping initBackend");
			this.unregisterBackendProvider?.(); // ensure no stale provider
			return;
		}

		// (Re)create client if needed or if URL changed
		if (!this._backendClient || this._backendClient.getBaseUrl() !== url) {
			this._backendClient = new BackendClient(url);
		}

		// Register backend with the vault path (zero-config)
		const basePath = (this.app.vault.adapter as any).getBasePath?.() ?? "";

		if (!basePath) {
			log.warn("Cannot get vault base path for backend registration");
			this.refreshBackendProvider();
			await this.refreshBackendCapabilities();
			return;
		}
		
		try {
			// Use vault name from settings or generate one from path
			const vaultName = this.app.vault.getName() || "default-vault";

			await this._backendClient.register(vaultName, basePath);
			log.info("HTTP POST {base}/register");
		} catch (error) {
			log.warn("Backend register failed — check server", error);
			// Continue with provider registration even if register fails
			// The backend might still be available for queries
		}

		// Register the virtual link provider
		this.refreshBackendProvider();
		await this.refreshBackendCapabilities();
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
		if (!this.inferredWikilinksAPI || typeof this.inferredWikilinksAPI.registerVirtualLinkProvider !== 'function') {
			log.warn("inferredWikilinksAPI not ready; will try again soon");
			return;
		}

		this.unregisterBackendProvider = createBackendLinksProvider(
			this.inferredWikilinksAPI,
			this._backendClient
		);
		log.info("backend virtual provider registered");
	}

	private async refreshBackendCapabilities(): Promise<void> {
		if (!this._backendClient) {
			this.backendCapabilities.clear();
			return;
		}

		try {
			const status = await this._backendClient.status();
			const capabilities = new Set(status?.capabilities ?? []);
			const hadCapability = this.backendCapabilities.has("snippets:snw-text");
			this.backendCapabilities = capabilities;

			if (capabilities.has("snippets:snw-text")) {
				if (!this.hasLoggedSnwAvailability || !hadCapability) {
					log.info("SNW structural snippets available.");
					this.hasLoggedSnwAvailability = true;
				}
			} else {
				this.hasLoggedSnwAvailability = false;
			}
		} catch (error) {
			log.warn("backend status check failed", error);
			this.backendCapabilities.clear();
		}
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
			log.error("unload error", error);
		}
	}
}
