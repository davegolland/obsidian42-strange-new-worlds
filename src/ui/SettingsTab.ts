import { type App, PluginSettingTab, Setting, type ToggleComponent } from "obsidian";
import type SNWPlugin from "../main";
import { getPolicyOptions } from "../policies/index";
import { 
	createSettingsHeading, 
	createSettingsSlider, 
	createSettingsToggle, 
	createSettingsToggleGroup 
} from "./components";

export class SettingsTab extends PluginSettingTab {
	plugin: SNWPlugin;

	constructor(app: App, plugin: SNWPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Startup section
		createSettingsToggleGroup({
			containerEl,
			headingText: "Enable on startup",
			toggles: [
				{
					name: "On the desktop enable SNW at startup",
					value: this.plugin.settings.startup.enableOnDesktop,
					onChange: async (value: boolean) => {
						this.plugin.settings.startup.enableOnDesktop = value;
						await this.plugin.saveSettings();
					}
				},
				{
					name: "On mobile devices enable SNW at startup",
					value: this.plugin.settings.startup.enableOnMobile,
					onChange: async (value: boolean) => {
						this.plugin.settings.startup.enableOnMobile = value;
						await this.plugin.saveSettings();
					}
				}
			]
		});

		// SNW Activation section
		createSettingsHeading({
			containerEl,
			headingText: "SNW Activation"
		});

		createSettingsToggle({
			containerEl,
			name: "Require modifier key to activate SNW",
			description: 
				`If enabled, SNW will only activate when the modifier key is pressed when hovering the mouse over an SNW counter.  
				Otherwise, SNW will activate on a mouse hover. May require reopening open files to take effect.`,
			value: this.plugin.settings.requireModifierKeyToActivateSNWView,
			onChange: async (value: boolean) => {
				this.plugin.settings.requireModifierKeyToActivateSNWView = value;
				await this.plugin.saveSettings();
			}
		});

		// Thresholds section
		createSettingsHeading({
			containerEl,
			headingText: "Thresholds"
		});

		createSettingsSlider({
			containerEl,
			name: "Minimal required count to show counter",
			description: `This setting defines how many references there needs to be for the reference count box to appear. May require reloading open files.
				Currently set to: ${this.plugin.settings.minimumRefCountThreshold} references.`,
			min: 1,
			max: 1000,
			step: 1,
			value: this.plugin.settings.minimumRefCountThreshold,
			onChange: async (value) => {
				this.plugin.settings.minimumRefCountThreshold = value;
				await this.plugin.saveSettings();
			}
		});

		createSettingsSlider({
			containerEl,
			name: "Maximum file references to show",
			description: `This setting defines the max amount of files with their references are displayed in the popup or sidebar. Set to 1000 for no maximum.
				Currently set to: ${this.plugin.settings.maxFileCountToDisplay} references. Keep in mind higher numbers can affect performance on larger vaults.`,
			min: 1,
			max: 1000,
			step: 1,
			value: this.plugin.settings.maxFileCountToDisplay,
			onChange: async (value) => {
				this.plugin.settings.maxFileCountToDisplay = value;
				await this.plugin.saveSettings();
			}
		});

		// Use Obsidian's Excluded Files section
		createSettingsToggleGroup({
			containerEl,
			headingText: "Use Obsidian's Excluded Files list (Settings > Files & Links)",
			toggles: [
				{
					name: "Outgoing links",
					description: "If enabled, links FROM files in the excluded folder will not be included in SNW's reference counters. May require restarting Obsidian.",
					value: this.plugin.settings.ignore.obsExcludeFoldersLinksFrom,
					onChange: async (value: boolean) => {
						this.plugin.settings.ignore.obsExcludeFoldersLinksFrom = value;
						await this.plugin.saveSettings();
					}
				},
				{
					name: "Incoming links",
					description: "If enabled, links TO files in the excluded folder will not be included in SNW's reference counters. May require restarting Obsidian.",
					value: this.plugin.settings.ignore.obsExcludeFoldersLinksTo,
					onChange: async (value: boolean) => {
						this.plugin.settings.ignore.obsExcludeFoldersLinksTo = value;
						await this.plugin.saveSettings();
					}
				}
			]
		});

		// Properties section
		createSettingsToggleGroup({
			containerEl,
			headingText: "Properties",
			toggles: [
				{
					name: "Show references in properties on Desktop",
					value: this.plugin.settings.display.propertyReferences,
					onChange: async (value: boolean) => {
						this.plugin.settings.display.propertyReferences = value;
						await this.plugin.saveSettings();
					}
				},
				{
					name: "Show references in properties on mobile",
					value: this.plugin.settings.display.propertyReferencesMobile,
					onChange: async (value: boolean) => {
						this.plugin.settings.display.propertyReferencesMobile = value;
						await this.plugin.saveSettings();
					}
				}
			]
		});

		new Setting(containerEl).setHeading().setName("View Modes");

		new Setting(containerEl)
			.setName("Incoming Links Header Count")
			.setDesc("In header of a document, show number of incoming link to that file.")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.display.incomingFilesHeader);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.display.incomingFilesHeader = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Show SNW indicators in Live Preview Editor")
			.setDesc(
				"While using Live Preview, Display inline of the text of documents all reference counts for links, blocks and embeds." +
					"Note: files may need to be closed and reopened for this setting to take effect.",
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.display.inlineReferencesLivePreview);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.display.inlineReferencesLivePreview = value;
					this.plugin.toggleStateSNWLivePreview();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Show SNW indicators in Reading view ")
			.setDesc(
				"While in Reading View of a document, display inline of the text of documents all reference counts for links, blocks and embeds." +
					"Note: files may need to be closed and reopened for this setting to take effect.",
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.display.inlineReferencesMarkdown);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.display.inlineReferencesMarkdown = value;
					this.plugin.toggleStateSNWMarkdownPreview();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Show SNW indicators in Source Mode ")
			.setDesc(
				"While in Source Mode of a document, display inline of the text of documents all reference counts for links, blocks and embeds." +
					"By default, this is turned off since the goal of Source Mode is to see the raw markdown." +
					"Note: files may need to be closed and reopened for this setting to take effect.",
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.display.inlineReferencesInSourceMode);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.display.inlineReferencesInSourceMode = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Embed references in Gutter in Live Preview Mode (Desktop)")
			.setDesc(
				`Displays a count of references in the gutter while in live preview. This is done only in a
					  special scenario. It has to do with the way Obsidian renders embeds, example: ![[link]] when  
					  they are on its own line. Strange New Worlds cannot embed the count in this scenario, so a hint is 
					  displayed in the gutter. It is a hack, but at least we get some information.`,
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.embed.referencesInGutter);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.embed.referencesInGutter = value;
					this.plugin.toggleStateSNWGutters();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Embed references in Gutter in Live Preview Mode (Mobile)")
			.setDesc("This is off by default on mobile since the gutter takes up some space in the left margin.")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.embed.referencesInGutterMobile);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.embed.referencesInGutterMobile = value;
					this.plugin.toggleStateSNWGutters();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setHeading().setName("Enable reference types in Reading Mode");
		containerEl.createEl("sup", {
			text: "(requires reopening documents to take effect)",
		});

		new Setting(containerEl)
			.setName("Block ID")
			.setDesc("Identifies block ID's, for example text blocks that end with a ^ and unique ID for that text block.")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.blockIdInMarkdown);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.blockIdInMarkdown = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Embeds")
			.setDesc("Identifies embedded links, that is links that start with an explanation mark. For example: ![[PageName]].")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.embedsInMarkdown);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.embedsInMarkdown = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Links")
			.setDesc("Identifies links in a document. For example: [[PageName]].")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.linksInMarkdown);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.linksInMarkdown = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Headers")
			.setDesc("Identifies headers, that is lines of text that start with a hash mark or multiple hash marks. For example: # Heading 1.")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.headersInMarkdown);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.headersInMarkdown = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setHeading().setName("Enable reference types in Live Preview Mode");
		containerEl.createEl("sup", {
			text: "(requires reopening documents to take effect)",
		});

		new Setting(containerEl)
			.setName("Block ID")
			.setDesc("Identifies block ID's, for example text blocks that end with a ^ and unique ID for that text block.")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.blockIdInLivePreview);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.blockIdInLivePreview = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Embeds")
			.setDesc("Identifies embedded links, that is links that start with an explanation mark. For example: ![[PageName]].")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.embedsInLivePreview);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.embedsInLivePreview = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Links")
			.setDesc("Identifies links in a document. For example: [[PageName]].")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.linksInLivePreview);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.linksInLivePreview = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Headers")
			.setDesc("Identifies headers, that is lines of text that start with a hash mark or multiple hash marks. For example: # Heading 1.")
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.render.headersInLivePreview);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.render.headersInLivePreview = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setHeading().setName("Custom Display Settings");

		new Setting(this.containerEl)
			.setName("Custom Property List")
			.setDesc(
				"Displays properties from referenced files in the references list. The list is comma separated list of case-sensitive property names.",
			)
			.addText((cb) => {
				cb.setPlaceholder("Ex: Project, Summary")
					.setValue(this.plugin.settings.displayCustomPropertyList)
					.onChange(async (list) => {
						this.plugin.settings.displayCustomPropertyList = list;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setHeading().setName("Support for Other Plugins");

		new Setting(containerEl)
			.setName("Kanban by mgmeyers")
			.setDesc(
				`Enables SNW support with in the preview mode of the Kanban plugin by mgmeyers at https://github.com/mgmeyers/obsidian-kanban. 
				SNW references will always show when editing a card. Changing this setting may require reopening files.`,
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.pluginSupportKanban);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.pluginSupportKanban = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setHeading().setName("Reference Counting");

		new Setting(containerEl)
			.setName("Wikilink equivalence policy")
			.setDesc(
				"Choose how wikilinks are grouped when counting references. This determines when different links are considered equivalent."
			)
			.addDropdown((dropdown) => {
				const policyOptions = getPolicyOptions();
				policyOptions.forEach(option => {
					dropdown.addOption(option.value, option.name);
				});
				
				dropdown
					.setValue(this.plugin.settings.wikilinkEquivalencePolicy)
					.onChange(async (value) => {
						this.plugin.settings.wikilinkEquivalencePolicy = value as any;
						this.plugin.referenceCountingPolicy.setActivePolicy(value);
						await this.plugin.saveSettings();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Rebuild References")
					.setTooltip("Force rebuild all references using the selected policy")
					.onClick(() => {
						this.plugin.referenceCountingPolicy.buildLinksAndReferences().catch(console.error);
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Toggle Debug")
					.setTooltip("Enable/Disable debug mode for troubleshooting (logs to console)")
					.onClick(() => {
						const debugEnabled = !this.plugin.referenceCountingPolicy.isDebugModeEnabled();
						this.plugin.referenceCountingPolicy.setDebugMode(debugEnabled);
					});
			});

		// Implicit Links section
		new Setting(containerEl).setHeading().setName("Implicit Links");

		new Setting(containerEl)
			.setName("Detection Mode")
			.setDesc("Choose how implicit links are detected in your documents.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("off", "Disabled")
					.addOption("regex", "Regex Patterns")
					.addOption("dictionary", "Dictionary (Notes & Aliases)")
					.setValue(this.plugin.settings.autoLinks.detectionMode)
					.onChange(async (value) => {
						this.plugin.settings.autoLinks.detectionMode = value as "off" | "regex" | "dictionary";
						await this.plugin.saveSettings();
					});
			});

		// Regex Rules section (only show if detection mode is regex)
		if (this.plugin.settings.autoLinks.detectionMode === "regex") {
			new Setting(containerEl).setHeading().setName("Regex Rules");

			// Add existing rules
			this.plugin.settings.autoLinks.regexRules.forEach((rule, index) => {
				this.createRegexRuleSetting(containerEl, index, rule);
			});

			// Add button to create new rule
			new Setting(containerEl)
				.setName("Add Regex Rule")
				.setDesc("Add a new regex pattern to detect implicit links")
				.addButton((button) => {
					button
						.setButtonText("Add Rule")
						.onClick(async () => {
							this.plugin.settings.autoLinks.regexRules.push({
								pattern: "",
								flags: "gi",
								targetTemplate: "",
								displayTemplate: ""
							});
							await this.plugin.saveSettings();
							this.display(); // Refresh the settings tab
						});
				});
		}

		// Dictionary Configuration section (only show if detection mode is dictionary)
		if (this.plugin.settings.autoLinks.detectionMode === "dictionary") {
			new Setting(containerEl).setHeading().setName("Dictionary Configuration");

			// Sources configuration
			new Setting(containerEl)
				.setName("Include Note Basenames")
				.setDesc("Detect links to note filenames (e.g., 'My Note' links to 'My Note.md')")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoLinks.dictionary?.sources.basenames ?? true)
						.onChange(async (value) => {
							if (!this.plugin.settings.autoLinks.dictionary) {
								this.plugin.settings.autoLinks.dictionary = {
									sources: { basenames: true, aliases: true, headings: false, customList: false },
									minPhraseLength: 3,
									requireWordBoundaries: true,
									customPhrases: [],
								};
							}
							this.plugin.settings.autoLinks.dictionary.sources.basenames = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Include Frontmatter Aliases")
				.setDesc("Detect links to aliases defined in note frontmatter")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoLinks.dictionary?.sources.aliases ?? true)
						.onChange(async (value) => {
							if (!this.plugin.settings.autoLinks.dictionary) {
								this.plugin.settings.autoLinks.dictionary = {
									sources: { basenames: true, aliases: true, headings: false, customList: false },
									minPhraseLength: 3,
									requireWordBoundaries: true,
									customPhrases: [],
								};
							}
							this.plugin.settings.autoLinks.dictionary.sources.aliases = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Include Note Headings")
				.setDesc("Detect links to headings within notes (experimental)")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoLinks.dictionary?.sources.headings ?? false)
						.onChange(async (value) => {
							if (!this.plugin.settings.autoLinks.dictionary) {
								this.plugin.settings.autoLinks.dictionary = {
									sources: { basenames: true, aliases: true, headings: false, customList: false },
									minPhraseLength: 3,
									requireWordBoundaries: true,
									customPhrases: [],
								};
							}
							this.plugin.settings.autoLinks.dictionary.sources.headings = value;
							await this.plugin.saveSettings();
						});
				});

			// Min phrase length
			new Setting(containerEl)
				.setName("Minimum Phrase Length")
				.setDesc(`Ignore phrases shorter than this many characters. Currently set to: ${this.plugin.settings.autoLinks.dictionary?.minPhraseLength ?? 3} characters.`)
				.addSlider((slider) => {
					slider
						.setLimits(1, 10, 1)
						.setValue(this.plugin.settings.autoLinks.dictionary?.minPhraseLength ?? 3)
						.setDynamicTooltip()
						.onChange(async (value) => {
							if (!this.plugin.settings.autoLinks.dictionary) {
								this.plugin.settings.autoLinks.dictionary = {
									sources: { basenames: true, aliases: true, headings: false, customList: false },
									minPhraseLength: 3,
									requireWordBoundaries: true,
									customPhrases: [],
								};
							}
							this.plugin.settings.autoLinks.dictionary.minPhraseLength = value;
							await this.plugin.saveSettings();
						});
				});

			// Word boundaries
			new Setting(containerEl)
				.setName("Require Word Boundaries")
				.setDesc("Only match complete words (prevents 'Language' from matching inside 'LanguageModel')")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoLinks.dictionary?.requireWordBoundaries ?? true)
						.onChange(async (value) => {
							if (!this.plugin.settings.autoLinks.dictionary) {
								this.plugin.settings.autoLinks.dictionary = {
									sources: { basenames: true, aliases: true, headings: false, customList: false },
									minPhraseLength: 3,
									requireWordBoundaries: true,
									customPhrases: [],
								};
							}
							this.plugin.settings.autoLinks.dictionary.requireWordBoundaries = value;
							await this.plugin.saveSettings();
						});
				});

			// Custom phrases section
			new Setting(containerEl)
				.setName("Include Custom Phrases")
				.setDesc("Use a hardcoded list of phrases to detect (independent of your vault content)")
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoLinks.dictionary?.sources.customList ?? false)
						.onChange(async (value) => {
							if (!this.plugin.settings.autoLinks.dictionary) {
								this.plugin.settings.autoLinks.dictionary = {
									sources: { basenames: true, aliases: true, headings: false, customList: false },
									minPhraseLength: 3,
									requireWordBoundaries: true,
									customPhrases: [],
								};
							}
							this.plugin.settings.autoLinks.dictionary.sources.customList = value;
							await this.plugin.saveSettings();
						});
				});

			// Custom phrases list (only show if custom list is enabled)
			if (this.plugin.settings.autoLinks.dictionary?.sources.customList) {
				new Setting(containerEl).setHeading().setName("Custom Phrases");

				// Add existing custom phrases
				const customPhrases = this.plugin.settings.autoLinks.dictionary?.customPhrases || [];
				customPhrases.forEach((phrase, index) => {
					this.createCustomPhraseSetting(containerEl, index, phrase);
				});

				// Add button to create new custom phrase
				new Setting(containerEl)
					.setName("Add Custom Phrase")
					.setDesc("Add a new phrase to the hardcoded detection list")
					.addButton((button) => {
						button
							.setButtonText("Add Phrase")
							.onClick(async () => {
								if (!this.plugin.settings.autoLinks.dictionary) {
									this.plugin.settings.autoLinks.dictionary = {
										sources: { basenames: true, aliases: true, headings: false, customList: false },
										minPhraseLength: 3,
										requireWordBoundaries: true,
										customPhrases: [],
									};
								}
								this.plugin.settings.autoLinks.dictionary.customPhrases.push("");
								await this.plugin.saveSettings();
								this.display(); // Refresh the settings tab
							});
					});
			}
		}
	}

	private createCustomPhraseSetting(containerEl: HTMLElement, index: number, phrase: string) {
		const phraseContainer = containerEl.createDiv("custom-phrase-container");
		phraseContainer.style.border = "1px solid var(--background-modifier-border)";
		phraseContainer.style.padding = "10px";
		phraseContainer.style.marginBottom = "10px";
		phraseContainer.style.borderRadius = "4px";

		// Phrase header with delete button
		const headerContainer = phraseContainer.createDiv("custom-phrase-header");
		headerContainer.style.display = "flex";
		headerContainer.style.justifyContent = "space-between";
		headerContainer.style.alignItems = "center";
		headerContainer.style.marginBottom = "10px";

		const phraseTitle = headerContainer.createDiv();
		phraseTitle.textContent = `Custom Phrase ${index + 1}`;

		const deleteButton = headerContainer.createEl("button");
		deleteButton.textContent = "Delete";
		deleteButton.onclick = async () => {
			if (this.plugin.settings.autoLinks.dictionary?.customPhrases) {
				this.plugin.settings.autoLinks.dictionary.customPhrases.splice(index, 1);
				await this.plugin.saveSettings();
				this.display(); // Refresh the settings tab
			}
		};

		// Phrase text setting
		new Setting(phraseContainer)
			.setName("Phrase")
			.setDesc("The exact phrase to detect (e.g., 'Natural Language Processing')")
			.addText((text) => {
				text
					.setPlaceholder("Enter phrase here")
					.setValue(phrase)
					.onChange(async (value) => {
						if (this.plugin.settings.autoLinks.dictionary?.customPhrases) {
							this.plugin.settings.autoLinks.dictionary.customPhrases[index] = value;
							await this.plugin.saveSettings();
						}
					});
			});
	}

	private createRegexRuleSetting(containerEl: HTMLElement, index: number, rule: any) {
		const ruleContainer = containerEl.createDiv("regex-rule-container");

		// Rule header with delete button
		const headerContainer = ruleContainer.createDiv("regex-rule-header");

		const ruleTitle = headerContainer.createDiv();
		ruleTitle.textContent = `Rule ${index + 1}`;

		const deleteButton = headerContainer.createEl("button");
		deleteButton.textContent = "Delete";
		deleteButton.onclick = async () => {
			this.plugin.settings.autoLinks.regexRules.splice(index, 1);
			await this.plugin.saveSettings();
			this.display(); // Refresh the settings tab
		};

		// Pattern setting
		new Setting(ruleContainer)
			.setName("Pattern")
			.setDesc("Regex pattern to match (e.g., \\bNatural Language Programming\\b)")
			.addText((text) => {
				text
					.setPlaceholder("\\b\\w+\\b")
					.setValue(rule.pattern)
					.onChange(async (value) => {
						this.plugin.settings.autoLinks.regexRules[index].pattern = value;
						await this.plugin.saveSettings();
					});
			});

		// Flags setting
		new Setting(ruleContainer)
			.setName("Flags")
			.setDesc("Regex flags (e.g., gi for global, case-insensitive)")
			.addText((text) => {
				text
					.setPlaceholder("gi")
					.setValue(rule.flags)
					.onChange(async (value) => {
						this.plugin.settings.autoLinks.regexRules[index].flags = value;
						await this.plugin.saveSettings();
					});
			});

		// Target template setting
		new Setting(ruleContainer)
			.setName("Target Template")
			.setDesc("Target file path template (use ${0} for full match, ${1} for first group, etc.)")
			.addText((text) => {
				text
					.setPlaceholder("Encyclopedia/${0}.md")
					.setValue(rule.targetTemplate)
					.onChange(async (value) => {
						this.plugin.settings.autoLinks.regexRules[index].targetTemplate = value;
						await this.plugin.saveSettings();
					});
			});

		// Display template setting (optional)
		new Setting(ruleContainer)
			.setName("Display Template (Optional)")
			.setDesc("Display text template (leave empty to use full match)")
			.addText((text) => {
				text
					.setPlaceholder("${0}")
					.setValue(rule.displayTemplate || "")
					.onChange(async (value) => {
						this.plugin.settings.autoLinks.regexRules[index].displayTemplate = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
