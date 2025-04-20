import { type App, PluginSettingTab, Setting, type ToggleComponent } from "obsidian";
import type SNWPlugin from "../main";
import { getPolicyOptions } from "../policies/index";

export class SettingsTab extends PluginSettingTab {
	plugin: SNWPlugin;

	constructor(app: App, plugin: SNWPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setHeading().setName("Enable on startup");
		new Setting(containerEl).setName("On the desktop enable SNW at startup").addToggle((cb: ToggleComponent) => {
			cb.setValue(this.plugin.settings.startup.enableOnDesktop);
			cb.onChange(async (value: boolean) => {
				this.plugin.settings.startup.enableOnDesktop = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl).setName("On mobile devices enable SNW at startup").addToggle((cb: ToggleComponent) => {
			cb.setValue(this.plugin.settings.startup.enableOnMobile);
			cb.onChange(async (value: boolean) => {
				this.plugin.settings.startup.enableOnMobile = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl).setHeading().setName("SNW Activation");
		new Setting(containerEl)
			.setName("Require modifier key to activate SNW")
			.setDesc(
				`If enabled, SNW will only activate when the modifier key is pressed when hovering the mouse over an SNW counter.  
						Otherwise, SNW will activate on a mouse hover. May require reopening open files to take effect.`,
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.requireModifierKeyToActivateSNWView);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.requireModifierKeyToActivateSNWView = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setHeading().setName("Thresholds");
		new Setting(containerEl)
			.setName("Minimal required count to show counter")
			.setDesc(
				`This setting defines how many references there needs to be for the reference count box to appear. May require reloading open files.
				 Currently set to: ${this.plugin.settings.minimumRefCountThreshold} references.`,
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 1000, 1)
					.setValue(this.plugin.settings.minimumRefCountThreshold)
					.onChange(async (value) => {
						this.plugin.settings.minimumRefCountThreshold = value;
						await this.plugin.saveSettings();
					})
					.setDynamicTooltip(),
			);

		new Setting(containerEl)
			.setName("Maximum file references to show")
			.setDesc(
				`This setting defines the max amount of files with their references are displayed in the popup or sidebar.  Set to 1000 for no maximum.
				 Currently set to: ${this.plugin.settings.maxFileCountToDisplay} references. Keep in mind higher numbers can affect performance on larger vaults.`,
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 1000, 1)
					.setValue(this.plugin.settings.maxFileCountToDisplay)
					.onChange(async (value) => {
						this.plugin.settings.maxFileCountToDisplay = value;
						await this.plugin.saveSettings();
					})
					.setDynamicTooltip(),
			);

		new Setting(containerEl).setHeading().setName(`Use Obsidian's Excluded Files list (Settings > Files & Links)`);

		new Setting(containerEl)
			.setName("Outgoing links")
			.setDesc(
				"If enabled, links FROM files in the excluded folder will not be included in SNW's reference counters. May require restarting Obsidian.",
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.ignore.obsExcludeFoldersLinksFrom);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.ignore.obsExcludeFoldersLinksFrom = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Incoming links")
			.setDesc(
				"If enabled, links TO files in the excluded folder will not be included in SNW's reference counters.  May require restarting Obsidian.",
			)
			.addToggle((cb: ToggleComponent) => {
				cb.setValue(this.plugin.settings.ignore.obsExcludeFoldersLinksTo);
				cb.onChange(async (value: boolean) => {
					this.plugin.settings.ignore.obsExcludeFoldersLinksTo = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setHeading().setName("Properties");

		new Setting(containerEl).setName("Show references in properties on Desktop").addToggle((cb: ToggleComponent) => {
			cb.setValue(this.plugin.settings.display.propertyReferences);
			cb.onChange(async (value: boolean) => {
				this.plugin.settings.display.propertyReferences = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl).setName("Show references in properties on mobile").addToggle((cb: ToggleComponent) => {
			cb.setValue(this.plugin.settings.display.propertyReferencesMobile);
			cb.onChange(async (value: boolean) => {
				this.plugin.settings.display.propertyReferencesMobile = value;
				await this.plugin.saveSettings();
			});
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
						this.plugin.referenceCountingPolicy.buildLinksAndReferences();
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
	}
}
