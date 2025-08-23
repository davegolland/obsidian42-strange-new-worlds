import { Setting } from "obsidian";

export interface SettingsHeadingProps {
	containerEl: HTMLElement;
	headingText: string;
	description?: string;
}

export function createSettingsHeading({ containerEl, headingText, description }: SettingsHeadingProps): void {
	const heading = new Setting(containerEl).setHeading().setName(headingText);

	if (description) {
		containerEl.createEl("sup", { text: description });
	}
}

export function createSettingsSeparator(containerEl: HTMLElement): void {
	containerEl.createEl("hr", { cls: "snw-settings-separator" });
}
