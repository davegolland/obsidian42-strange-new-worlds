import type { ComponentChildren, FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export interface DropdownProps {
	buttonContent: ComponentChildren;
	isOpen?: boolean;
	onToggle?: () => void;
	className?: string;
	buttonClassName?: string;
	listClassName?: string;
	children: ComponentChildren;
}

export const Dropdown: FunctionComponent<DropdownProps> = ({
	buttonContent,
	isOpen: externalIsOpen,
	onToggle,
	className = "snw-dropdown-wrapper",
	buttonClassName = "snw-dropdown-button",
	listClassName = "snw-dropdown-list",
	children,
}) => {
	const [internalIsOpen, setInternalIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Determine if component is controlled or uncontrolled
	const isControlled = externalIsOpen !== undefined;
	const isOpen = isControlled ? externalIsOpen : internalIsOpen;

	const handleButtonClick = () => {
		if (!isControlled) {
			setInternalIsOpen(!internalIsOpen);
		}
		onToggle?.();
	};

	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				if (!isControlled) {
					setInternalIsOpen(false);
				} else {
					onToggle?.();
				}
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen, isControlled, onToggle]);

	return (
		<div className={className} ref={menuRef}>
			<button type="button" onClick={handleButtonClick} class={buttonClassName}>
				{buttonContent}
			</button>
			{isOpen && <ul className={listClassName}>{children}</ul>}
		</div>
	);
};
