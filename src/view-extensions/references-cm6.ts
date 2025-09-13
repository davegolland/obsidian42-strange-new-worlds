import { Transaction } from "@codemirror/state";
/**
 * Codemirror extension - hook into the CM editor
 * CM will call update as the doc updates.
 */
import { Decoration, type DecorationSet, type EditorView, MatchDecorator, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { type TFile, editorInfoField, parseLinktext, stripHeading } from "obsidian";
import type SNWPlugin from "src/main";
import SnwAPI from "src/snwApi";
import type { ReferenceCountingPolicy } from "../policies/reference-counting";
import type { TransformedCachedItem } from "../types";
import { getUIC_HoverviewElement } from "../ui/components/uic-ref--parent";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
// htmlDecorationForReferencesElement removed - was from deleted htmlDecorations.tsx

let plugin: SNWPlugin;
let referenceCountingPolicy: ReferenceCountingPolicy;

export function setPluginVariableForCM6InlineReferences(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
	referenceCountingPolicy = plugin.referenceCountingPolicy;
}

/**
 * Factory function that creates a CM6 extension bound to a specific plugin instance
 */
export const inlineDecorationsExtension = (plugin: SNWPlugin) =>
	ViewPlugin.fromClass(
		class {
			decorator: MatchDecorator | undefined;
			decorations: DecorationSet = Decoration.none;
			regxPattern = "";

			constructor(public view: EditorView) {
				// Store plugin reference
				(this as any)._plugin = plugin;
				
				// The constructor seems to be called only once when a file is viewed. The decorator is called multipe times.
				const p: SNWPlugin = (this as any)._plugin;
				this.regxPattern = "(\\s\\^)(\\S+)$";
				this.regxPattern += `|!\\[\\[[^\\]]+?\\]\\]`;
				this.regxPattern += `|\\[\\[[^\\]]+?\\]\\]`;
				this.regxPattern += `|^#+\\s.+`;

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
						if (!mdView.file) {
							const ref = match[0].replace(/^\[\[|\]\]$|^!\[\[|\]\]$/g, "");
							const key = referenceCountingPolicy.generateKeyFromPathAndLink("/", ref);
							if (key) {
								const refType = match.input.startsWith("!") ? "embed" : "link";
								mdViewFile = p.app.metadataCache.getFirstLinkpathDest(parseLinktext(ref).path, "/") as TFile;
								const references = p.snwAPI.references.get(key);

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
							if (p.settings.displayInlineReferencesInSourceMode === false && mdView.currentMode?.sourceMode === true) return null;

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
									if (true) {
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
									p,
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
				
				// Hard guard: if the bridge isn't ready, render nothing (prevents TypeError)
				const p = (this as any)._plugin;
				if (!p || typeof p.getSNWCacheByFile !== "function") {
					this.decorations = Decoration.none;
					return;
				}
				
				// Normal reactive rebuilds
				if (this.regxPattern !== "" && (update.docChanged || update.viewportChanged)) {
					this.decorations = this.decorator.updateDeco(update, this.decorations);
				}

				// If we receive our "snw-refresh" userEvent, force a full rebuild even
				// when the doc/viewport haven't changed (index became ready).
				const refreshed = update.transactions?.some((tr) => tr.annotation(Transaction.userEvent) === "snw-refresh");
				if (refreshed) {
					this.refresh(update.view);
				}
			}
		},
		{
			decorations: (v) => {
				// Hard guard: if the bridge isn't ready, render nothing (prevents TypeError)
				const p = (v as any)._plugin;
				if (!p || typeof p.getSNWCacheByFile !== "function") {
					return Decoration.none;
				}
				return v.decorations;
			},
		},
	);

// Legacy export for backward compatibility
export const InlineReferenceExtension = inlineDecorationsExtension;

// Helper function for preparing the Widget for displaying the reference count
const constructWidgetForInlineReference = (
	refType: string,
	key: string,
	references: TransformedCachedItem[],
	filePath: string,
	fileExtension: string,
	plugin: SNWPlugin,
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
			if (refCount >= 1)
				return new InlineReferenceWidget(
					refCount,
					ref.type,
					ref.references[0].realLink,
					ref.key,
					filePath,
					"snw-liveupdate",
					ref.pos.start.line,
					plugin,
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
	plugin: SNWPlugin; // Store plugin reference

	constructor(refCount: number, cssclass: string, realLink: string, key: string, filePath: string, addCSSClass: string, lineNu: number, plugin: SNWPlugin) {
		super();
		this.referenceCount = refCount;
		this.referenceType = cssclass;
		this.realLink = realLink;
		this.key = key;
		this.filePath = filePath;
		this.addCssClass = addCSSClass;
		this.lineNu = lineNu;
		this.plugin = plugin;
	}

	// eq(other: InlineReferenceWidget) {
	//     return other.referenceCount == this.referenceCount;
	// }

	toDOM() {
		// Create the reference counter element
		const el = document.createElement("span");
		el.className = `snw-reference snw-inline-ref ${this.addCssClass || ""}`;
		el.textContent = this.referenceCount.toString();
		el.title = `${this.referenceType} • ${this.referenceCount} reference${this.referenceCount === 1 ? "" : "s"}`;
		
		// Add required data attributes for tooltip functionality
		el.setAttribute("data-snw-type", this.referenceType);
		el.setAttribute("data-snw-reallink", this.realLink);
		el.setAttribute("data-snw-key", this.key);
		el.setAttribute("data-snw-filepath", this.filePath);
		el.setAttribute("snw-data-line-number", this.lineNu.toString());
		
		// Set up tippy hover with proper configuration
		const tip = tippy(el, {
			theme: "snw-tippy",
			interactive: true,
			appendTo: () => document.body,
			allowHTML: true,
			zIndex: 9999,
			trigger: this.plugin?.settings?.requireModifierForHover ? "manual" : "mouseenter focus",
			onShow: async (instance) => {
				// Build popover DOM (do NOT append inline) and assign to Tippy
				const contentEl = await getUIC_HoverviewElement({
					referenceEl: el,
					plugin: this.plugin
				});
				if (contentEl) instance.setContent(contentEl);
			},
		});
		
		// Handle modifier key requirement
		if (this.plugin?.settings?.requireModifierForHover) {
			el.addEventListener("mouseenter", (e) => {
				if (e instanceof MouseEvent && (e.ctrlKey || e.metaKey)) {
					tip.show();
				}
			});
			el.addEventListener("mouseleave", () => {
				tip.hide();
			});
		}
		
		return el;
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
