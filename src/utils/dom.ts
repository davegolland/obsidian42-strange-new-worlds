// pulled from here: https://github.com/slindberg/jquery-scrollparent/blob/master/jquery.scrollparent.js
export const getScrollParent = (element: HTMLElement, includeHidden: boolean): HTMLElement => {
	let style = getComputedStyle(element);
	const excludeStaticParent = style.position === "absolute";
	const overflowRegex = includeHidden ? /(auto|scroll|hidden)/ : /(auto|scroll)/;

	if (style.position === "fixed") return document.body;
	for (let parent: HTMLElement | null = element.parentElement; parent; parent = parent.parentElement) {
		style = getComputedStyle(parent);
		if (!excludeStaticParent || style.position !== "static") {
			if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) {
				return parent;
			}
		}
	}

	return document.body;
};
