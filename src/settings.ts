export type SortOption = "name-asc" | "name-desc" | "mtime-asc" | "mtime-desc";
export type { WikilinkEquivalencePolicyType } from "./policies/auto-types";

export interface AutoLinkSettings {
	enabledLivePreview: boolean;
	enabledReadingView: boolean;
	detectionMode: "off" | "regex" | "dictionary";
	regexRules: Array<{
		pattern: string; // e.g. "\\bNatural Language Programming\\b"
		flags: string; // e.g. "gi"
		targetTemplate: string; // e.g. "Encyclopedia/${0}.md"
		displayTemplate?: string; // optional, e.g. "${0}"
	}>;
	dictionary?: {
		sources: {
			basenames: boolean; // Note basenames (default: true)
			aliases: boolean; // frontmatter aliases[] (default: true)
			headings: boolean; // Markdown headings in each note (default: false)
			customList: boolean; // Use hardcoded custom phrases (default: false)
		};
		minPhraseLength: number; // characters; ignore very short keys (default: 3)
		requireWordBoundaries: boolean; // only match as whole words (default: true)
		customPhrases: string[]; // Hardcoded list of phrases to detect
	};
}

export interface RenderSettings {
	blockIdInMarkdown: boolean;
	linksInMarkdown: boolean;
	headersInMarkdown: boolean;
	embedsInMarkdown: boolean;
	blockIdInLivePreview: boolean;
	linksInLivePreview: boolean;
	headersInLivePreview: boolean;
	embedsInLivePreview: boolean;
}

export interface DisplaySettings {
	incomingFilesHeader: boolean;
	inlineReferencesLivePreview: boolean;
	inlineReferencesMarkdown: boolean;
	inlineReferencesInSourceMode: boolean;
	propertyReferences: boolean;
	propertyReferencesMobile: boolean;
}

export interface EmbedSettings {
	referencesInGutter: boolean;
	referencesInGutterMobile: boolean;
}

export interface StartupSettings {
	enableOnDesktop: boolean;
	enableOnMobile: boolean;
}

export interface IgnoreSettings {
	obsExcludeFoldersLinksFrom: boolean;
	obsExcludeFoldersLinksTo: boolean;
}

export interface DevSettings {
	diagDecorations: boolean;
	forceLegacy: boolean;
}

export interface BackendSettings {
	enabled: boolean;
	baseUrl: string;
}

export interface Settings {
	startup: StartupSettings;
	display: DisplaySettings;
	embed: EmbedSettings;
	render: RenderSettings;
	ignore: IgnoreSettings;
	dev: DevSettings;
	minimumRefCountThreshold: number;
	maxFileCountToDisplay: number;
	requireModifierKeyToActivateSNWView: boolean;
	sortOptionDefault: SortOption;
	displayCustomPropertyList: string;
	pluginSupportKanban: boolean;
	wikilinkEquivalencePolicy: WikilinkEquivalencePolicyType;
	autoLinks: AutoLinkSettings;
	backend: BackendSettings;
}

export const DEFAULT_SETTINGS: Settings = {
	startup: {
		enableOnDesktop: true,
		enableOnMobile: true,
	},
	display: {
		incomingFilesHeader: true,
		inlineReferencesLivePreview: true,
		inlineReferencesMarkdown: true,
		inlineReferencesInSourceMode: false,
		propertyReferences: true,
		propertyReferencesMobile: false,
	},
	embed: {
		referencesInGutter: false,
		referencesInGutterMobile: false,
	},
	render: {
		blockIdInMarkdown: true,
		linksInMarkdown: true,
		headersInMarkdown: true,
		embedsInMarkdown: true,
		blockIdInLivePreview: true,
		linksInLivePreview: true,
		headersInLivePreview: true,
		embedsInLivePreview: true,
	},
	ignore: {
		obsExcludeFoldersLinksFrom: false,
		obsExcludeFoldersLinksTo: false,
	},
	dev: {
		diagDecorations: false,
		forceLegacy: false,
	},
	minimumRefCountThreshold: 1,
	maxFileCountToDisplay: 100,
	requireModifierKeyToActivateSNWView: false,
	sortOptionDefault: "name-asc",
	displayCustomPropertyList: "",
	pluginSupportKanban: false,
	wikilinkEquivalencePolicy: "case-insensitive",
			autoLinks: {
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
		},
		backend: {
			enabled: false,
			baseUrl: "http://localhost:8000",
		},
};

// For backward compatibility with older settings format
export interface LegacySettings {
	enableOnStartupDesktop: boolean;
	enableOnStartupMobile: boolean;
	minimumRefCountThreshold: number;
	maxFileCountToDisplay: number;
	displayIncomingFilesheader: boolean;
	displayInlineReferencesLivePreview: boolean;
	displayInlineReferencesMarkdown: boolean;
	displayInlineReferencesInSourceMode: boolean;
	displayEmbedReferencesInGutter: boolean;
	displayEmbedReferencesInGutterMobile: boolean;
	displayPropertyReferences: boolean;
	displayPropertyReferencesMobile: boolean;
	enableRenderingBlockIdInMarkdown: boolean;
	enableRenderingLinksInMarkdown: boolean;
	enableRenderingHeadersInMarkdown: boolean;
	enableRenderingEmbedsInMarkdown: boolean;
	enableRenderingBlockIdInLivePreview: boolean;
	enableRenderingLinksInLivePreview: boolean;
	enableRenderingHeadersInLivePreview: boolean;
	enableRenderingEmbedsInLivePreview: boolean;
	enableIgnoreObsExcludeFoldersLinksFrom: boolean;
	enableIgnoreObsExcludeFoldersLinksTo: boolean;
	requireModifierKeyToActivateSNWView: boolean;
	sortOptionDefault: SortOption;
	displayCustomPropertyList: string;
	pluginSupportKanban: boolean;
	wikilinkEquivalencePolicy: WikilinkEquivalencePolicyType;
}

// Utility function to migrate from legacy settings to new format
export function migrateSettings(legacySettings: LegacySettings): Settings {
	return {
		startup: {
			enableOnDesktop: legacySettings.enableOnStartupDesktop,
			enableOnMobile: legacySettings.enableOnStartupMobile,
		},
		display: {
			incomingFilesHeader: legacySettings.displayIncomingFilesheader,
			inlineReferencesLivePreview: legacySettings.displayInlineReferencesLivePreview,
			inlineReferencesMarkdown: legacySettings.displayInlineReferencesMarkdown,
			inlineReferencesInSourceMode: legacySettings.displayInlineReferencesInSourceMode,
			propertyReferences: legacySettings.displayPropertyReferences,
			propertyReferencesMobile: legacySettings.displayPropertyReferencesMobile,
		},
		embed: {
			referencesInGutter: legacySettings.displayEmbedReferencesInGutter,
			referencesInGutterMobile: legacySettings.displayEmbedReferencesInGutterMobile,
		},
		render: {
			blockIdInMarkdown: legacySettings.enableRenderingBlockIdInMarkdown,
			linksInMarkdown: legacySettings.enableRenderingLinksInMarkdown,
			headersInMarkdown: legacySettings.enableRenderingHeadersInMarkdown,
			embedsInMarkdown: legacySettings.enableRenderingEmbedsInMarkdown,
			blockIdInLivePreview: legacySettings.enableRenderingBlockIdInLivePreview,
			linksInLivePreview: legacySettings.enableRenderingLinksInLivePreview,
			headersInLivePreview: legacySettings.enableRenderingHeadersInLivePreview,
			embedsInLivePreview: legacySettings.enableRenderingEmbedsInLivePreview,
		},
		ignore: {
			obsExcludeFoldersLinksFrom: legacySettings.enableIgnoreObsExcludeFoldersLinksFrom,
			obsExcludeFoldersLinksTo: legacySettings.enableIgnoreObsExcludeFoldersLinksTo,
		},
		minimumRefCountThreshold: legacySettings.minimumRefCountThreshold,
		maxFileCountToDisplay: legacySettings.maxFileCountToDisplay,
		requireModifierKeyToActivateSNWView: legacySettings.requireModifierKeyToActivateSNWView,
		sortOptionDefault: legacySettings.sortOptionDefault,
		displayCustomPropertyList: legacySettings.displayCustomPropertyList,
		pluginSupportKanban: legacySettings.pluginSupportKanban,
		wikilinkEquivalencePolicy: legacySettings.wikilinkEquivalencePolicy,
		autoLinks: {
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
		},
		backend: {
			enabled: false,
			baseUrl: "http://localhost:8000",
		},
	};
}
