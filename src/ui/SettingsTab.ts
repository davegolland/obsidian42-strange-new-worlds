import { type App, PluginSettingTab, Setting } from "obsidian";
import type SNWPlugin from "../main";

export class SettingsTab extends PluginSettingTab {
	plugin: SNWPlugin;

	constructor(app: App, plugin: SNWPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Minimal mode: only two settings supported
		// Backend URL setting
		new Setting(containerEl)
			.setName("Backend URL")
			.setDesc("Base URI for inferred wikilinks backend")
			.addText(t => t
				.setPlaceholder("http://localhost:8000")
				.setValue(this.plugin.settings.backendUrl)
				.onChange(async (v) => {
					await this.plugin.updateSettings({ backendUrl: v.trim() });
				}));

		// Modifier key setting
		new Setting(containerEl)
			.setName("Require Cmd/Ctrl to open hover")
			.setDesc("When on, hover popover opens only while holding Cmd (macOS) or Ctrl (Windows/Linux).")
			.addToggle(t => t
				.setValue(this.plugin.settings.requireModifierForHover)
				.onChange(async (v) => {
					await this.plugin.updateSettings({ requireModifierForHover: v });
				}));

	}
}

