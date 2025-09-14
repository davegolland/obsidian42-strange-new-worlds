//wrapper element for references area. shared between popover and sidepane

import { setIcon } from "obsidian";
import { render } from "preact";
import type InferredWikilinksPlugin from "src/main";
import type { Link } from "src/types";
import { wireHoverEvents } from "./hover-content";
import { getUIC_Ref_Item } from "./uic-ref-item";
import { getUIC_Ref_Title_Div } from "./uic-ref-title";
import { ATTR } from "../attr";
import { log } from "../../diag";

export function setPluginVariableUIC_RefArea(inferredWikilinksPlugin: InferredWikilinksPlugin) {
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
	plugin: InferredWikilinksPlugin,
	display?: string,
): Promise<HTMLElement> => {
	const refAreaItems = await getRefAreaItems(refType, realLink, key, filePath, plugin);
	const refAreaContainerEl = createDiv();

	//get title header for this reference area
	refAreaContainerEl.append(
		getUIC_Ref_Title_Div(refType, realLink, key, filePath, refAreaItems.refCount, lineNu, plugin, display),
	);

	const refAreaEl = createDiv({ cls: "snw-ref-area" });
	refAreaEl.append(refAreaItems.response);
	refAreaContainerEl.append(refAreaEl);

	return refAreaContainerEl;
};


// Creates a DIV for a collection of reference blocks to be displayed
const getRefAreaItems = async (refType: string, realLink: string, key: string, filePath: string, plugin: InferredWikilinksPlugin): Promise<{ response: HTMLElement; refCount: number }> => {
	let linksToLoop: Link[] = [];

	// Always use backend for all reference types - KISS principle
	try {
		let term: string;
		
		if (refType === "File") {
			// For file references, use the file path as the term
			term = filePath;
		} else if (refType === 'implicit' && realLink.startsWith('keyword:')) {
			// Extract the term from the keyword: prefix
			term = realLink.replace('keyword:', '');
		} else {
			// Fallback to key for other types
			term = key;
		}

		const references = await plugin.backendClient?.getReferences(term, 0);
		
		if (references && references.references.length > 0) {
			// Helper to create pseudo TFile for invalid backend payloads
			const makePseudoTFile = (p: string) => {
				const base = (p?.split?.("/")?.pop?.() ?? p ?? "");
				return {
					path: p ?? "",
					basename: base.replace(/\.md$/i, ""),
					stat: { mtime: 0 },
				} as any;
			};

			// Convert backend references to Link format for compatibility
			linksToLoop = references.references.map(ref => {
				const tf = makePseudoTFile(ref?.file ?? "");
				return {
					sourceFile: tf,
					resolvedFile: null,
					reference: {
						link: ref?.file ?? "",
						key: ref?.file ?? "",
						displayText: ref?.title || tf.basename,
						position: {
							start: { line: ref?.line ?? 0, col: ref?.col ?? 0, offset: 0 },
							end:   { line: ref?.line ?? 0, col: ref?.col ?? 0, offset: 0 },
						},
					},
				} as Link;
			});
			
			log.info("[SNW hover] backend references for term=%s → %d", term, linksToLoop.length);
		} else {
			// No backend references found
			const hint = createDiv({ cls: "snw-ref-empty" });
			hint.setText("No indexed backlinks found.");
			const container = createDiv();
			container.append(hint);
			return { response: container, refCount: 0 };
		}
	} catch (error) {
		log.warn("[SNW hover] backend references failed:", error);
		// Fallback to empty state
		const hint = createDiv({ cls: "snw-ref-empty" });
		hint.setText("No indexed backlinks found.");
		const container = createDiv();
		container.append(hint);
		return { response: container, refCount: 0 };
	}

	const countOfRefs = linksToLoop.length;
	
	// Log how many items the list will render
	log.info("[SNW hover] items for key=%s → %d", key, linksToLoop.length);

	// Deduplicate while preserving backend order
	const dedupPreserveOrder = (links: Link[]) => {
		const seen = new Set<string>();
		const out: Link[] = [];
		for (const l of links) {
			const k = l?.sourceFile?.path ?? l?.reference?.key ?? "";
			if (!k || seen.has(k)) continue;
			seen.add(k);
			out.push(l);
		}
		return out;
	};

	const uniqueFileKeys = dedupPreserveOrder(linksToLoop);

	const wrapperEl = createDiv();

	let maxItemsToShow = 100;

	if (countOfRefs < maxItemsToShow) {
		maxItemsToShow = countOfRefs;
	}

	let itemsDisplayedCounter = 0;

	let customProperties = null;
	if (false)
		customProperties = [].map((x) => x.trim());

	for (let index = 0; index < uniqueFileKeys.length; index++) {
		if (itemsDisplayedCounter > maxItemsToShow) continue;
		const file_path = uniqueFileKeys[index];
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

