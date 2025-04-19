import { GutterMarker, gutter } from "@codemirror/view";
import type { BlockInfo, EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type SNWPlugin from "src/main";
import { htmlDecorationForReferencesElement } from "src/view-extensions/htmlDecorations";
import { ReferenceCountingPolicy } from "../policies/reference-counting";

let plugin: SNWPlugin;
let referenceCountingPolicy: ReferenceCountingPolicy;

export function setPluginVariableForCM6Gutter(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
	referenceCountingPolicy = plugin.referenceCountingPolicy;
}

const referenceGutterMarker = class extends GutterMarker {
	referenceCount: number;
	referenceType: string;
	key: string; //a unique identifier for the reference
	realLink: string;
	filePath: string;
	addCssClass: string; //if a reference need special treatment, this class can be assigned

	constructor(refCount: number, cssclass: string, realLink: string, key: string, filePath: string, addCSSClass: string) {
		super();
		this.referenceCount = refCount;
		this.referenceType = cssclass;
		this.realLink = realLink;
		this.key = key;
		this.filePath = filePath;
		this.addCssClass = addCSSClass;
	}

	toDOM() {
		return htmlDecorationForReferencesElement(
			this.referenceCount,
			this.referenceType,
			this.realLink,
			this.key,
			this.filePath,
			this.addCssClass,
			0,
		);
	}
};

const emptyMarker = new (class extends GutterMarker {
	toDOM() {
		return document.createTextNode("øøø");
	}
})();

const ReferenceGutterExtension = gutter({
	class: "snw-gutter-ref",
	lineMarker(editorView: EditorView, line: BlockInfo) {
		const mdView = editorView.state.field(editorInfoField);

		// @ts-ignore - Check if should show in source mode
		if (mdView.currentMode?.sourceMode === true && plugin.settings.displayInlineReferencesInSourceMode === false) return null;

		if (!mdView.file) return null;
		const transformedCache = referenceCountingPolicy.getSNWCacheByFile(mdView.file);

		// check if the page is to be ignored
		if (transformedCache?.cacheMetaData?.frontmatter?.["snw-file-exclude"] === true) return null;
		if (transformedCache?.cacheMetaData?.frontmatter?.["snw-canvas-exclude-edit"] === true) return null;

		const embedsFromMetaDataCache = mdView.app.metadataCache.getFileCache(mdView.file)?.embeds;
		if (!embedsFromMetaDataCache || !embedsFromMetaDataCache.length) return null;

		const lineNumberInFile = editorView.state.doc.lineAt(line.from).number;
		for (const embed of embedsFromMetaDataCache) {
			if (embed.position.start.line + 1 === lineNumberInFile) {
				for (const ref of transformedCache?.embeds ?? []) {
					const refCount = referenceCountingPolicy.countReferences(ref?.references);
					if (
						refCount >= Math.max(2, plugin.settings.minimumRefCountThreshold) &&
						ref?.pos.start.line + 1 === lineNumberInFile
					) {
						const lineToAnalyze = editorView.state.doc.lineAt(line.from).text.trim();
						if (lineToAnalyze.startsWith("!")) {
							// Remove  [[ and ]] and split by | to get the link text if aliased
							const strippedLineToAnalyze = lineToAnalyze.replace("![[", "").replace("]]", "").split("|")[0];
							const lineFromFile = (
								strippedLineToAnalyze.startsWith("#")
									? mdView.file + strippedLineToAnalyze
									: referenceCountingPolicy.parseLinkTextToFullPath(strippedLineToAnalyze) || strippedLineToAnalyze
							).toLocaleUpperCase();
							if (lineFromFile === ref.key) {
								return new referenceGutterMarker(
									refCount,
									"embed",
									ref.references[0].realLink,
									ref.key,
									ref.references[0].resolvedFile?.path ?? "",
									"snw-embed-special snw-liveupdate",
								);
							}
						}
					}
				}
			}
		}

		return null;
	},
	initialSpacer: () => emptyMarker,
});

export default ReferenceGutterExtension;
