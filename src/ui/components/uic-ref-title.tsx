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
	plugin: SNWPlugin,
	display?: string,
	handleSortOptionChangeCallback?: () => void,
): HTMLElement => {
	const titleElJsx = (
		<div className="snw-ref-title-popover tree-item-self is-clickable">
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
		</div>
	);

	const titleEl = createDiv();
	render(titleElJsx, titleEl);

	return titleEl;
};
