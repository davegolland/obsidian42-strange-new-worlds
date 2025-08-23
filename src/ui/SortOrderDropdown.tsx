import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import type SNWPlugin from "src/main";
import type { SortOption } from "../settings";
import { Dropdown, DropdownOption } from "./components";

interface SortOptionUI {
	label: string;
	icon: string;
}

const sortOptions: Record<string, SortOptionUI> = {
	"name-asc": {
		label: "Name",
		icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-a-z"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/></svg>',
	},
	"name-desc": {
		label: "Name",
		icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-z-a"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M15 4h5l-5 6h5"/><path d="M15 20v-3.5a2.5 2.5 0 0 1 5 0V20"/><path d="M20 18h-5"/></svg>',
	},
	"mtime-asc": {
		label: "Date",
		icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-0-1"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><rect x="15" y="4" width="4" height="6" ry="2"/><path d="M17 20v-6h-2"/><path d="M15 20h4"/></svg>',
	},
	"mtime-desc": {
		label: "Date",
		icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-1-0"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M17 10V4h-2"/><path d="M15 10h4"/><rect x="15" y="14" width="4" height="6" ry="2"/></svg>',
	},
};

interface SortOrderDropdownProps {
	plugin: SNWPlugin;
	onChange: () => void;
}

export const SortOrderDropdown: FunctionComponent<SortOrderDropdownProps> = ({ plugin, onChange }) => {
	const [isOpen, setIsOpen] = useState(false);

	const handleToggle = () => {
		setIsOpen(!isOpen);
	};

	const handleOptionClick = async (value: string) => {
		setIsOpen(false);
		plugin.settings.sortOptionDefault = value as SortOption;
		await plugin.saveSettings();
		onChange();
	};

	const currentSortOption = sortOptions[plugin.settings.sortOptionDefault];

	// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG icon rendering
	const buttonContent = <div dangerouslySetInnerHTML={{ __html: currentSortOption.icon }} />;

	return (
		<Dropdown
			buttonContent={buttonContent}
			isOpen={isOpen}
			onToggle={handleToggle}
			className="snw-sort-dropdown-wrapper"
			buttonClassName="snw-sort-dropdown-button"
			listClassName="snw-sort-dropdown-list"
		>
			{Object.entries(sortOptions).map(([value, { label, icon }]) => (
				<DropdownOption
					key={value}
					value={value}
					icon={icon}
					label={label}
					onClick={(value) => handleOptionClick(value)}
					className="snw-sort-dropdown-list-item"
					labelClassName="snw-sort-dropdown-list-item-label"
				/>
			))}
		</Dropdown>
	);
};
