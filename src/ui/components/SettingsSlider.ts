import { Setting } from "obsidian";

export interface SettingsSliderProps {
	containerEl: HTMLElement;
	name: string;
	description: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onChange: (value: number) => Promise<void>;
}

export function createSettingsSlider({ containerEl, name, description, min, max, step, value, onChange }: SettingsSliderProps): Setting {
	const setting = new Setting(containerEl)
		.setName(name)
		.setDesc(description)
		.addSlider((slider) =>
			slider
				.setLimits(min, max, step)
				.setValue(value)
				.onChange(async (newValue) => {
					await onChange(newValue);
				})
				.setDynamicTooltip(),
		);

	return setting;
}
