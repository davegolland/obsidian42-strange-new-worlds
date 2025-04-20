export type SortOption = "name-asc" | "name-desc" | "mtime-asc" | "mtime-desc";
export type WikilinkEquivalencePolicyType = "case-insensitive" | "same-file" | "word-form" | "base-name" | "unique-files";

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

export interface Settings {
	startup: StartupSettings;
	display: DisplaySettings;
	embed: EmbedSettings;
	render: RenderSettings;
	ignore: IgnoreSettings;
	minimumRefCountThreshold: number;
	maxFileCountToDisplay: number;
	requireModifierKeyToActivateSNWView: boolean;
	sortOptionDefault: SortOption;
	displayCustomPropertyList: string;
	pluginSupportKanban: boolean;
	wikilinkEquivalencePolicy: WikilinkEquivalencePolicyType;
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
	minimumRefCountThreshold: 1,
	maxFileCountToDisplay: 100,
	requireModifierKeyToActivateSNWView: false,
	sortOptionDefault: "name-asc",
	displayCustomPropertyList: "",
	pluginSupportKanban: false,
	wikilinkEquivalencePolicy: "case-insensitive",
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
	};
}
