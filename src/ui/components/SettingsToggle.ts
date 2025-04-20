import { Setting, type ToggleComponent } from "obsidian";

export interface SettingsToggleProps {
	containerEl: HTMLElement;
	name: string;
	description?: string;
	value: boolean;
	onChange: (value: boolean) => Promise<void>;
}

export function createSettingsToggle({
	containerEl,
	name,
	description,
	value,
	onChange,
}: SettingsToggleProps): Setting {
	const setting = new Setting(containerEl).setName(name);
	
	if (description) {
		setting.setDesc(description);
	}
	
	setting.addToggle((cb: ToggleComponent) => {
		cb.setValue(value);
		cb.onChange(async (newValue: boolean) => {
			await onChange(newValue);
		});
	});
	
	return setting;
} 