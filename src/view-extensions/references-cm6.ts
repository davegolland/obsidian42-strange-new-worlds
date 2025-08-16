/**
 * Codemirror extension - hook into the CM editor
 * CM will call update as the doc updates.
 */
import { Decoration, type DecorationSet, type EditorView, MatchDecorator, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { editorInfoField, parseLinktext, stripHeading, TFile } from "obsidian";
import type SNWPlugin from "src/main";
import type { TransformedCachedItem } from "../types";
import { htmlDecorationForReferencesElement } from "./htmlDecorations";
import SnwAPI from "src/snwApi";
import { ReferenceCountingPolicy } from "../policies/reference-counting";

let plugin: SNWPlugin;
let referenceCountingPolicy: ReferenceCountingPolicy;

export function setPluginVariableForCM6InlineReferences(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
	referenceCountingPolicy = plugin.referenceCountingPolicy;
}

/**
 * CM widget for renderinged matched ranges of references. This allows us to provide our UX for matches.
 */
export const InlineReferenceExtension = ViewPlugin.fromClass(
	class {
		decorator: MatchDecorator | undefined;
		decorations: DecorationSet = Decoration.none;
		regxPattern = "";

		constructor(public view: EditorView) {
			// The constructor seems to be called only once when a file is viewed. The decorator is called multipe times.
			if (plugin.settings.render.blockIdInLivePreview) this.regxPattern = "(\\s\\^)(\\S+)$";
			if (plugin.settings.render.embedsInLivePreview) this.regxPattern += `${this.regxPattern !== "" ? "|" : ""}!\\[\\[[^\\]]+?\\]\\]`;
			if (plugin.settings.render.linksInLivePreview)  this.regxPattern += `${this.regxPattern !== "" ? "|" : ""}\\[\\[[^\\]]+?\\]\\]`;
			if (plugin.settings.render.headersInLivePreview) this.regxPattern += `${this.regxPattern !== "" ? "|" : ""}^#+\\s.+`;

			//if there is no regex pattern, then don't go further
			if (this.regxPattern === "") return;

			this.decorator = new MatchDecorator({
				regexp: new RegExp(this.regxPattern, "g"),
				decorate: (add, from, to, match, view) => {
					const mdView = view.state.field(editorInfoField);

					const widgetsToAdd: {
						key: string;
						transformedCachedItem: TransformedCachedItem[] | null;
						refType: string;
						from: number;
						to: number;
					}[] = [];

					let mdViewFile: TFile | null = null;

					// there is no file, likely a canvas file, look for links and embeds, process it with snwApi.references
					if (!mdView.file && (plugin.settings.render.embedsInLivePreview || plugin.settings.render.linksInLivePreview)) {
						const ref = match[0].replace(/^\[\[|\]\]$|^!\[\[|\]\]$/g, "");
						const key = referenceCountingPolicy.generateKeyFromPathAndLink("/", ref);
						if (key) {
							const refType = match.input.startsWith("!") ? "embed" : "link";
							mdViewFile = plugin.app.metadataCache.getFirstLinkpathDest(parseLinktext(ref).path, "/") as TFile;
							const references = plugin.snwAPI.references.get(key);

							const newTransformedCachedItem = [
								{
									key: key,
									page: mdViewFile.path,
									type: refType,
									pos: { start: { line: 0, ch: 0, col: 0, offset: 0 }, end: { line: 0, ch: 0, col: 0, offset: 0 } },
									references: references ?? [],
								},
							];

							widgetsToAdd.push({
								key: key,
								transformedCachedItem: newTransformedCachedItem ?? null,
								refType: refType,
								from: to,
								to: to,
							});
						}
					} else {
						// If we get this far, then it is a file, and process it using getSNWCacheByFile

						// @ts-ignore && Check if should show in source mode
						if (plugin.settings.displayInlineReferencesInSourceMode === false && mdView.currentMode?.sourceMode === true) return null;

						mdViewFile = mdView.file as TFile;

						// For now, use a synchronous approach - this will be updated in a future version
						// to properly handle virtual links
						const transformedCache = referenceCountingPolicy.getSNWCacheByFile(mdViewFile) as any;

						if (
							(transformedCache.links || transformedCache.headings || transformedCache.embeds || transformedCache.blocks) &&
							transformedCache?.cacheMetaData?.frontmatter?.["snw-file-exclude"] !== true &&
							transformedCache?.cacheMetaData?.frontmatter?.["snw-canvas-exclude-edit"] !== true
						) {
							const firstCharacterMatch = match[0].charAt(0);

							if (firstCharacterMatch === "[" && (transformedCache?.links?.length ?? 0) > 0) {
								let newLink = match[0].replace("[[", "").replace("]]", "");
								//link to an internal page link, add page name
								if (newLink.startsWith("#")) newLink = mdViewFile.path + newLink;
								const key = referenceCountingPolicy.generateKeyFromPathAndLink(mdViewFile.path, newLink);
								widgetsToAdd.push({
									key: key,
									transformedCachedItem: transformedCache.links ?? null,
									refType: "link",
									from: to,
									to: to,
								});
							} else if (
								firstCharacterMatch === "#" &&
								((transformedCache?.headings?.length || transformedCache?.links?.length) ?? 0) > 0
							) {
								//heading
								widgetsToAdd.push({
									key: stripHeading(match[0].replace(/^#+/, "").substring(1)),
									transformedCachedItem: transformedCache.headings ?? null,
									refType: "heading",
									from: to,
									to: to,
								});
								if (plugin.settings.render.linksInLivePreview) {
									// this was not working with mobile from 0.16.4 so had to convert it to a string
									const linksinHeader = match[0].match(/\[\[(.*?)\]\]|!\[\[(.*?)\]\]/g);
									if (linksinHeader)
										for (const l of linksinHeader) {
											const linkText = l.replace("![[", "").replace("[[", "").replace("]]", "");
											const key = referenceCountingPolicy.generateKeyFromPathAndLink(mdViewFile.path, linkText);
											widgetsToAdd.push({
												key: key,
												transformedCachedItem: l.startsWith("!") ? (transformedCache.embeds ?? null) : (transformedCache.links ?? null),
												refType: "link",
												from: to - match[0].length + (match[0].indexOf(l) + l.length),
												to: to - match[0].length + (match[0].indexOf(l) + l.length),
											});
										}
								}
							} else if (firstCharacterMatch === "!" && (transformedCache?.embeds?.length ?? 0) > 0) {
								//embeds
								let newEmbed = match[0].replace("![[", "").replace("]]", "");
								//link to an internal page link, add page name
								if (newEmbed.startsWith("#")) newEmbed = mdViewFile.path + stripHeading(newEmbed);
								const key = referenceCountingPolicy.generateKeyFromPathAndLink(mdViewFile.path, newEmbed);
								widgetsToAdd.push({
									key: key,
									transformedCachedItem: transformedCache.embeds ?? null,
									refType: "embed",
									from: to,
									to: to,
								});
							} else if (firstCharacterMatch === " " && (transformedCache?.blocks?.length ?? 0) > 0) {
								// Use the new policy-based key generation for blocks
								const blockId = match[0].replace(" ^", "");
								const blockPath = mdViewFile.path + "#^" + blockId;
								const key = referenceCountingPolicy.generateKeyFromPathAndLink(mdViewFile.path, "#^" + blockId);
								widgetsToAdd.push({
									key: key,
									transformedCachedItem: transformedCache.blocks ?? null,
									refType: "block",
									from: to,
									to: to,
								});
							}
						} // end for
					}

					if (widgetsToAdd.length === 0 || !mdViewFile) return;

					// first see if it is a heading, as it should be sorted to the end, then sort by position
					const sortWidgets = widgetsToAdd.sort((a, b) => (a.to === b.to ? (a.refType === "heading" ? 1 : -1) : a.to - b.to));

					for (const ref of widgetsToAdd) {
						if (ref.key !== "") {
							const wdgt = constructWidgetForInlineReference(
								ref.refType,
								ref.key,
								ref.transformedCachedItem ?? [],
								mdViewFile.path,
								mdViewFile.extension,
							);
							if (wdgt != null) {
								add(ref.from, ref.to, Decoration.widget({ widget: wdgt, side: 1 }));
							}
						}
					}
				},
			});

			this.decorations = this.decorator.createDeco(view);
		}

		// Called when we want to rebuild decorations after the index updates
		refresh(view: EditorView) {
			if (!this.decorator) return;
			this.decorations = this.decorator.createDeco(view);
		}

		update(update: ViewUpdate) {
			if (!this.decorator) return;
			// Normal reactive rebuilds
			if (this.regxPattern !== "" && (update.docChanged || update.viewportChanged)) {
				this.decorations = this.decorator.updateDeco(update, this.decorations);
			}

			// If we receive our "snw-refresh" userEvent, force a full rebuild even
			// when the doc/viewport haven't changed (index became ready).
			const refreshed = update.transactions?.some(tr =>
				tr.annotation(Transaction.userEvent) === "snw-refresh"
			);
			if (refreshed) {
				this.refresh(update.view);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

// Helper function for preparing the Widget for displaying the reference count
const constructWidgetForInlineReference = (
	refType: string,
	key: string,
	references: TransformedCachedItem[],
	filePath: string,
	fileExtension: string,
): InlineReferenceWidget | null => {
	let modifyKey = key;

	for (let i = 0; i < references.length; i++) {
		const ref = references[i];
		let matchKey = ref.key;

		if (refType === "heading") {
			matchKey = stripHeading(ref.headerMatch ?? ""); // headers require special comparison
			modifyKey = modifyKey.replace(/^\s+|\s+$/g, ""); // should be not leading spaces
		}

		const refCount = referenceCountingPolicy.countReferences(ref.references);
		// Remove the hard-coded skip for links with count = 1, let the threshold setting control this

		if (refType === "embed" || refType === "link") {
			// check for aliased references
			if (modifyKey.contains("|")) modifyKey = modifyKey.substring(0, key.search(/\|/));
			const parsedKey = referenceCountingPolicy.generateKeyFromPathAndLink(filePath, modifyKey);
			modifyKey = parsedKey === "" ? modifyKey : parsedKey; //if no results, likely a ghost link

			if (matchKey.startsWith("#")) {
				// internal page link
				matchKey = referenceCountingPolicy.generateKeyFromPathAndLink(filePath, matchKey);
			}
		}

		if (matchKey === modifyKey) {
			const filePath = ref?.references[0]?.resolvedFile
				? ref.references[0].resolvedFile.path.replace(`.${ref.references[0].resolvedFile}`, "")
				: modifyKey;
			if (refCount >= plugin.settings.minimumRefCountThreshold)
				return new InlineReferenceWidget(
					refCount,
					ref.type,
					ref.references[0].realLink,
					ref.key,
					filePath,
					"snw-liveupdate",
					ref.pos.start.line,
				);
			return null;
		}
	}
	return null;
};

// CM widget for renderinged matched ranges of references. This allows us to provide our UX for matches.
export class InlineReferenceWidget extends WidgetType {
	referenceCount: number;
	referenceType: string;
	realLink: string;
	key: string; //a unique identifier for the reference
	filePath: string;
	addCssClass: string; //if a reference need special treatment, this class can be assigned
	lineNu: number; //number of line within the file

	constructor(refCount: number, cssclass: string, realLink: string, key: string, filePath: string, addCSSClass: string, lineNu: number) {
		super();
		this.referenceCount = refCount;
		this.referenceType = cssclass;
		this.realLink = realLink;
		this.key = key;
		this.filePath = filePath;
		this.addCssClass = addCSSClass;
		this.lineNu = lineNu;
	}

	// eq(other: InlineReferenceWidget) {
	//     return other.referenceCount == this.referenceCount;
	// }

	toDOM() {
		return htmlDecorationForReferencesElement(
			this.referenceCount,
			this.referenceType,
			this.realLink,
			this.key,
			this.filePath,
			this.addCssClass,
			this.lineNu,
		);
	}

	destroy() {}

	ignoreEvent() {
		return false;
	}
}

// --- exported helper to rescan all editors after index updates ---
export function rescanAllInlineEditorsAfterIndexUpdate() {
	const leaves = plugin.app.workspace.getLeavesOfType("markdown");
	for (const leaf of leaves) {
		const md: any = (leaf as any).view;
		const cm: any = md?.editor?.cm;
		if (cm) {
			cm.dispatch({
				// no changes; just a tag our ViewPlugin watches for
				annotations: Transaction.userEvent.of("snw-refresh"),
			});
		}
	}
}
