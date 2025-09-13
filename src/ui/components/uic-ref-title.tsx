// Component to display the title at the top of a uic-ref-area

import { render } from "preact";
import type SNWPlugin from "src/main";
import { hideAll } from "tippy.js";
import { ATTR } from "../attr";
// IconMoreDetails and SortOrderDropdown removed - files were deleted

export const getUIC_Ref_Title_Div = (
	refType: string,
	realLink: string,
	key: string,
	filePath: string,
	refCount: number,
	lineNu: number,
	isPopover: boolean,
	plugin: SNWPlugin,
	display?: string,
	handleSortOptionChangeCallback?: () => void,
): HTMLElement => {
	const titleElJsx = (
		<div className={`${isPopover ? "snw-ref-title-popover" : "snw-ref-title-side-pane"} tree-item-self is-clickable`}>
			<div
				className="snw-ref-title-popover-label"
				{...{ [ATTR.titleType]: refType }}
				{...{ [ATTR.titleRealLink]: realLink }}
				{...{ [ATTR.titleKey]: key }}
				{...{ [ATTR.fileName]: filePath }}
				{...{ [ATTR.line]: lineNu.toString() }}
			>
				{(() => {
					// Use display if provided, otherwise fallback to existing logic
					if (display) {
						return display;
					}
					const src = filePath || realLink || "";
					const base = src.split("/").pop() || src;
					const pretty = base.replace(/\.md$/i, "");  // strip .md
					return pretty;
				})()}
			</div>
			{/* SortOrderDropdown removed - file was deleted */}
			{isPopover && (
				<span
					className="snw-ref-title-popover-open-sidepane-icon"
					snw-ref-title-type={refType}
					snw-ref-title-reallink={realLink}
					snw-ref-title-key={key}
					snw-data-file-name={filePath}
					snw-data-line-number={lineNu.toString()}
				>
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
					<span
						className="snw-ref-title-popover-icon"
						onClick={(e: MouseEvent) => {
							e.stopPropagation();
							hideAll({ duration: 0 }); // hide popup
							plugin.activateView(refType, realLink, key, filePath, Number(lineNu));
						}}
					>
						{/* IconMoreDetails removed - file was deleted */}
					</span>
				</span>
			)}
		</div>
	);

	const titleEl = createDiv();
	render(titleElJsx, titleEl);

	return titleEl;
};
