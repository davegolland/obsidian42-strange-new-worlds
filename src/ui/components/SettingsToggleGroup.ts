import { Setting } from "obsidian";
import { createSettingsHeading } from "./SettingsHeading";
import { createSettingsToggle, type SettingsToggleProps } from "./SettingsToggle";

export interface ToggleItem {
	name: string;
	description?: string;
	value: boolean;
	onChange: (value: boolean) => Promise<void>;
}

export interface SettingsToggleGroupProps {
	containerEl: HTMLElement;
	headingText: string;
	description?: string;
	toggles: ToggleItem[];
}

export function createSettingsToggleGroup({
	containerEl,
	headingText,
	description,
	toggles,
}: SettingsToggleGroupProps): void {
	// Create heading
	createSettingsHeading({
		containerEl,
		headingText,
		description,
	});
	
	// Create toggles
	toggles.forEach((toggle) => {
		createSettingsToggle({
			containerEl,
			name: toggle.name,
			description: toggle.description,
			value: toggle.value,
			onChange: toggle.onChange,
		});
	});
} 