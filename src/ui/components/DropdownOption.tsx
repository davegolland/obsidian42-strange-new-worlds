import { type FunctionComponent, type ComponentChildren } from "preact";

export interface DropdownOptionProps {
	id?: string;
	value: string;
	icon?: string;
	label?: string;
	onClick: (value: string, e: Event) => void;
	className?: string;
	iconClassName?: string;
	labelClassName?: string;
	children?: ComponentChildren;
}

export const DropdownOption: FunctionComponent<DropdownOptionProps> = ({
	id,
	value,
	icon,
	label,
	onClick,
	className = "snw-dropdown-list-item",
	iconClassName = "snw-dropdown-list-item-icon",
	labelClassName = "snw-dropdown-list-item-label",
	children,
}) => {
	const handleClick = (e: Event) => {
		e.stopPropagation();
		onClick(value, e);
	};

	return (
		<li
			id={id || value}
			onClick={handleClick}
			class={className}
		>
			{icon && (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG icon rendering
				<span className={iconClassName} dangerouslySetInnerHTML={{ __html: icon }} />
			)}
			
			{label && <span className={labelClassName}>{label}</span>}
			
			{children}
		</li>
	);
}; 