import { getScrollParent } from "./dom";

export const scrollResultsIntoView = (resultContainerEl: HTMLElement): void => {
	const searchResults = resultContainerEl.querySelectorAll(".search-result-file-matched-text");
	for (const searchResult of Array.from(searchResults)) {
		if (searchResult instanceof HTMLElement) {
			const scrollParent = getScrollParent(searchResult, true) as HTMLElement;
			if (scrollParent) {
				scrollParent.scrollTop = searchResult.offsetTop - scrollParent.offsetTop - scrollParent.offsetHeight / 2;
			}
		}
	}
};
