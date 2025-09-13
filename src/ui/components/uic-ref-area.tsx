//wrapper element for references area. shared between popover and sidepane

import { setIcon } from "obsidian";
import { render } from "preact";
import type SNWPlugin from "src/main";
import type { Link } from "src/types";
import type { ReferenceCountingPolicy } from "../../policies/reference-counting";
import type { SortOption } from "../../settings";
import { setFileLinkHandlers } from "./hover-content";
import { getUIC_Ref_Item } from "./uic-ref-item";
import { getUIC_Ref_Title_Div } from "./uic-ref-title";
import { ATTR } from "../attr";

export function setPluginVariableUIC_RefArea(snwPlugin: SNWPlugin) {
	// No longer needed - plugin is injected as parameter
}

//Creates the primarhy "AREA" body for displaying refrences. This is the overall wrapper for the title and individaul references
export const getUIC_Ref_Area = async (
	refType: string,
	realLink: string,
	key: string,
	filePath: string,
	lineNu: number,
	isHoverView: boolean,
	plugin: SNWPlugin,
	display?: string,
): Promise<HTMLElement> => {
	const refAreaItems = await getRefAreaItems(refType, realLink, key, filePath, plugin);
	const refAreaContainerEl = createDiv();

	//get title header for this reference area
	refAreaContainerEl.append(
		getUIC_Ref_Title_Div(refType, realLink, key, filePath, refAreaItems.refCount, lineNu, isHoverView, plugin, display, async () => {
			// Callback to re-render the references area when the sort option is changed
			const refAreaEl: HTMLElement | null = refAreaContainerEl.querySelector(".snw-ref-area");
			if (refAreaEl) {
				refAreaEl.style.visibility = "hidden";
				while (refAreaEl.firstChild) {
					refAreaEl.removeChild(refAreaEl.firstChild);
				}
				refAreaEl.style.visibility = "visible";
				const refAreaItems = await getRefAreaItems(refType, realLink, key, filePath, plugin);
				refAreaEl.prepend(refAreaItems.response);

				setTimeout(async () => {
					await setFileLinkHandlers(plugin, false, refAreaEl);
				}, 500);
			}
		}),
	);

	const refAreaEl = createDiv({ cls: "snw-ref-area" });
	refAreaEl.append(refAreaItems.response);
	refAreaContainerEl.append(refAreaEl);

	return refAreaContainerEl;
};

const sortLinks = (links: Link[], option: SortOption): Link[] => {
	return links.sort((a, b) => {
		const fileA = a.sourceFile;
		const fileB = b.sourceFile;
		switch (option) {
			case "name-asc":
				return fileA?.basename.localeCompare(fileB?.basename);
			case "name-desc":
				return fileB?.basename.localeCompare(fileA?.basename);
			case "mtime-asc":
				return fileA?.stat.mtime - fileB?.stat.mtime;
			case "mtime-desc":
				return fileB?.stat.mtime - fileA?.stat.mtime;
			default:
				return 0;
		}
	});
};

// Creates a DIV for a collection of reference blocks to be displayed
const getRefAreaItems = async (refType: string, realLink: string, key: string, filePath: string, plugin: SNWPlugin): Promise<{ response: HTMLElement; refCount: number }> => {
	let linksToLoop: Link[] = [];

	if (refType === "File") {
		const allLinks = plugin.referenceCountingPolicy.getIndexedReferences();
		const incomingLinks: Link[] = [];
		for (const items of allLinks.values()) {
			for (const item of items) {
				if (item?.resolvedFile && item?.resolvedFile?.path === filePath) {
					incomingLinks.push(item);
				}
			}
		}
		linksToLoop = referenceCountingPolicy.filterReferences(incomingLinks);
	} else {
		// Use backend references API for implicit links
		if (refType === 'implicit' && realLink.startsWith('keyword:')) {
			try {
				const linkId = realLink; // Use the realLink as linkId for backend keywords
				const references = await plugin.backendClient?.getReferences(linkId, 20);
				
				if (references && references.references.length > 0) {
					// Convert backend references to Link format for compatibility
					linksToLoop = references.references.map(ref => ({
						link: ref.file,
						displayText: ref.title,
						position: { start: { line: ref.line, col: ref.col, offset: 0 }, end: { line: ref.line, col: ref.col, offset: 0 } },
						sourceFile: { path: ref.file } as any,
						resolvedFile: null,
						reference: { link: ref.file, key: ref.file, displayText: ref.title, position: { start: { line: ref.line, col: ref.col, offset: 0 }, end: { line: ref.line, col: ref.col, offset: 0 } } },
					}));
					
					console.log("[SNW hover] backend references for linkId=%s → %d", linkId, linksToLoop.length);
				} else {
					// No backend references found
					const hint = createDiv({ cls: "snw-ref-empty" });
					hint.setText("No indexed backlinks (inferred link).");
					const container = createDiv();
					container.append(hint);
					return { response: container, refCount: 0 };
				}
			} catch (error) {
				console.warn("[SNW hover] backend references failed:", error);
				// Fallback to empty state
				const hint = createDiv({ cls: "snw-ref-empty" });
				hint.setText("No indexed backlinks (inferred link).");
				const container = createDiv();
				container.append(hint);
				return { response: container, refCount: 0 };
			}
		} else {
			// Use local index for non-minimal mode or non-implicit links
			const refCache = referenceCountingPolicy.getIndexedReferences().get(key) || [];
			const sortedCache = await sortRefCache(refCache);
			linksToLoop = referenceCountingPolicy.filterReferences(sortedCache);
			
			// Fallback: if nothing found and this is an implicit badge, show a friendly empty state
			if (!linksToLoop.length && refType === 'implicit') {
				const hint = createDiv({ cls: "snw-ref-empty" });
				hint.setText("No indexed backlinks (inferred link).");
				const container = createDiv();
				container.append(hint);
				return { response: container, refCount: 0 };
			}
		}
	}

	const countOfRefs = referenceCountingPolicy.countReferences(linksToLoop);
	
	// Log how many items the list will render
	console.log("[SNW hover] items for key=%s → %d", key, linksToLoop.length);

	// get the unique file names for files in thie refeernces
	const uniqueFileKeys: Link[] = Array.from(new Set(linksToLoop.map((a: Link) => a.sourceFile?.path)))
		.map((file_path) => {
			return linksToLoop.find((a) => a.sourceFile?.path === file_path);
		})
		.filter((link): link is Link => link !== undefined);

	const sortedFileKeys = sortLinks(uniqueFileKeys, "name-asc");

	const wrapperEl = createDiv();

	let maxItemsToShow = 100;

	if (countOfRefs < maxItemsToShow) {
		maxItemsToShow = countOfRefs;
	}

	let itemsDisplayedCounter = 0;

	let customProperties = null;
	if (false)
		customProperties = [].map((x) => x.trim());

	for (let index = 0; index < sortedFileKeys.length; index++) {
		if (itemsDisplayedCounter > maxItemsToShow) continue;
		const file_path = sortedFileKeys[index];
		if (!file_path.sourceFile) continue;

		const responseItemContainerEl = createDiv();
		responseItemContainerEl.addClass("snw-ref-item-container");
		responseItemContainerEl.addClass("tree-item");

		wrapperEl.appendChild(responseItemContainerEl);

		const refItemFileEl = createDiv();
		refItemFileEl.addClass("snw-ref-item-file");
		refItemFileEl.addClass("tree-item-self");
		refItemFileEl.addClass("search-result-file-title");
		refItemFileEl.addClass("is-clickable");
		refItemFileEl.setAttribute(ATTR.line, "-1");
		refItemFileEl.setAttribute(ATTR.fileName, file_path.sourceFile.path);
		refItemFileEl.setAttribute("data-href", file_path.sourceFile.path);
		refItemFileEl.setAttribute("href", file_path.sourceFile.path);

		const refItemFileIconEl = createDiv();
		refItemFileIconEl.addClass("snw-ref-item-file-icon");
		refItemFileIconEl.addClass("tree-item-icon");
		refItemFileIconEl.addClass("collapse-icon");
		setIcon(refItemFileIconEl, "file-box");

		const refItemFileLabelEl = createDiv();
		refItemFileLabelEl.addClass("snw-ref-item-file-label");
		refItemFileLabelEl.addClass("tree-item-inner");
		refItemFileLabelEl.innerText = file_path.sourceFile.basename;

		refItemFileEl.append(refItemFileIconEl);
		refItemFileEl.append(refItemFileLabelEl);

		responseItemContainerEl.appendChild(refItemFileEl);

		// Add custom property field to display
		if (customProperties != null) {
			const fileCache = file_path.sourceFile ? plugin.app.metadataCache.getFileCache(file_path.sourceFile) : null;

			// biome-ignore lint/complexity/noForEach: <explanation>
			customProperties.forEach((propName) => {
				const propValue = fileCache?.frontmatter?.[propName];
				if (propValue) {
					const customPropertyElement = (
						<div class="snw-custom-property-container">
							<span class="snw-custom-property-name">{propName}</span>
							<span class="snw-custom-property-text">: {propValue}</span>
						</div>
					);
					const fieldEl = createDiv();
					render(customPropertyElement, fieldEl);
					refItemFileLabelEl.append(fieldEl);
				}
			});
		}

		const refItemsCollectionE = createDiv();
		refItemsCollectionE.addClass("snw-ref-item-collection-items");
		refItemsCollectionE.addClass("search-result-file-matches");
		responseItemContainerEl.appendChild(refItemsCollectionE);

		for (const ref of linksToLoop) {
			if (file_path.sourceFile?.path === ref.sourceFile?.path && itemsDisplayedCounter < maxItemsToShow) {
				itemsDisplayedCounter += 1;
				refItemsCollectionE.appendChild(await getUIC_Ref_Item(ref, plugin));
			}
		}
	}

	return { response: wrapperEl, refCount: countOfRefs };
};

const sortRefCache = async (refCache: Link[]): Promise<Link[]> => {
	return refCache.sort((a, b) => {
		let positionA = 0; //added because of properties - need to fix later
		if (a.reference.position !== undefined) positionA = Number(a.reference.position.start.line);

		let positionB = 0; //added because of properties - need to fix later
		if (b.reference.position !== undefined) positionB = Number(b.reference.position.start.line);

		return a.sourceFile?.basename.localeCompare(b.sourceFile.basename) || Number(positionA) - Number(positionB);
	});
};
