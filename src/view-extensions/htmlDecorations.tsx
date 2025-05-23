import tippy from "tippy.js";
import type SNWPlugin from "../main";
import { UPDATE_DEBOUNCE } from "../main";
import "tippy.js/dist/tippy.css";
import { Platform, debounce } from "obsidian";
import { render } from "preact";
import { getUIC_Hoverview } from "src/ui/components/uic-ref--parent";

let plugin: SNWPlugin;

export function setPluginVariableForHtmlDecorations(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
}

/**
 * Creates the JSX element for decoration
 * @param params Parameters for creating the element
 * @returns JSX element
 */
function createReferenceElementJsx(params: {
	referenceType: string;
	realLink: string;
	key: string;
	filePath: string;
	attachCSSClass: string;
	lineNu: number;
	count: number;
}) {
	const { referenceType, realLink, key, filePath, attachCSSClass, lineNu, count } = params;
	
	return (
		<div
			className={`snw-reference snw-${referenceType} ${attachCSSClass}`}
			data-snw-type={referenceType}
			data-snw-reallink={realLink}
			data-snw-key={key}
			data-snw-filepath={filePath}
			snw-data-line-number={lineNu.toString()}
		>
			{count.toString()}
		</div>
	);
}

/**
 * Attaches click handler to the element
 * @param refCountBox The HTML element to attach handler to
 */
function attachClickHandler(refCountBox: HTMLElement) {
	if (Platform.isDesktop || Platform.isDesktopApp) {
		//click is default to desktop, otherwise mobile behaves differently
		refCountBox.onclick = async (e: MouseEvent) => processHtmlDecorationReferenceEvent(e.target as HTMLElement);
	}
}

/**
 * Adds tippy tooltip to the element
 * @param refCountBox The HTML element to add tippy to
 * @returns The tippy instance
 */
function addTippyToElement(refCountBox: HTMLElement) {
	const requireModifierKey = plugin.settings.requireModifierKeyToActivateSNWView;
	// defaults to showing tippy on hover, but if requireModifierKey is true, then only show on ctrl/meta key
	let showTippy = true;
	const tippyObject = tippy(refCountBox, {
		interactive: true,
		appendTo: () => document.body,
		allowHTML: true,
		zIndex: 9999,
		placement: "auto-end",
		// trigger: "click", // on click is another option instead of hovering at all
		onTrigger(instance, event) {
			const mouseEvent = event as MouseEvent;
			if (requireModifierKey === false) return;
			if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
				showTippy = true;
			} else {
				showTippy = false;
			}
		},
		onShow(instance) {
			// returning false will cancel the show (coming from onTrigger)
			if (!showTippy) return false;

			setTimeout(async () => {
				await getUIC_Hoverview(instance);
			}, 1);
		},
	});

	tippyObject.popper.classList.add("snw-tippy");
	return tippyObject;
}

/**
 * Shared function between references-cm6.ts and references-preview.
 * This decoration is just the html box drawn into the document with the count of references.
 * It is used in the header as well as inline in the document. If a user clicks on this element,
 * the function processHtmlDecorationReferenceEvent is called
 *
 * @export
 * @param {number} count            Number to show in the box
 * @param {string} referenceType    The type of references (block, embed, link, header)
 * @param {string} realLink         The real link to the reference contained in the document
 * @param {string} key              Unique key used to identify this reference based on its type
 * @param {string} filePath         File path in file in vault
 * @param {string} attachCSSClass   if special class is need for the element
 * @return {*}  {HTMLElement}
 */
export function htmlDecorationForReferencesElement(
	count: number,
	referenceType: string,
	realLink: string,
	key: string,
	filePath: string,
	attachCSSClass: string,
	lineNu: number,
): HTMLElement {
	// Create the element
	const referenceElementJsx = createReferenceElementJsx({
		referenceType,
		realLink,
		key,
		filePath,
		attachCSSClass,
		lineNu,
		count
	});

	const refenceElement = createDiv();
	render(referenceElementJsx, refenceElement);
	const refCountBox = refenceElement.firstElementChild as HTMLElement;

	// Attach click handler
	attachClickHandler(refCountBox);
	
	// Add tippy tooltip
	addTippyToElement(refCountBox);

	return refenceElement;
}

/**
 * Extracts reference attributes from the target element
 * @param target The HTML element to extract attributes from
 * @returns Object containing the extracted attributes
 */
function extractReferenceAttributes(target: HTMLElement) {
	return {
		refType: target.getAttribute("data-snw-type") ?? "",
		realLink: target.getAttribute("data-snw-realLink") ?? "",
		key: target.getAttribute("data-snw-key") ?? "",
		filePath: target.getAttribute("data-snw-filepath") ?? "",
		lineNu: target.getAttribute("snw-data-line-number") ?? "",
	};
}

/**
 * Activates the view with the extracted reference attributes
 * @param attributes Object containing reference attributes
 */
function activateReferenceView(attributes: { 
	refType: string; 
	realLink: string; 
	key: string; 
	filePath: string; 
	lineNu: string; 
}) {
	const { refType, realLink, key, filePath, lineNu } = attributes;
	plugin.activateView(refType, realLink, key, filePath, Number(lineNu));
}

//  Opens the sidebar SNW pane by calling activateView on main.ts
export const processHtmlDecorationReferenceEvent = async (target: HTMLElement) => {
	const attributes = extractReferenceAttributes(target);
	await activateReferenceView(attributes);
};

// Export the direct function instead of a debounced wrapper
export function updateAllSnwLiveUpdateReferences() {
	const elements = document.querySelectorAll(".snw-liveupdate");
	for (const el of Array.from(elements) as HTMLElement[]) {
		const newCount = plugin.snwAPI.references.get(el.dataset.snwKey)?.length ?? 0;
		if (newCount < plugin.settings.minimumRefCountThreshold) {
			el.remove();
			continue;
		}
		const newCountStr = String(newCount);
		if (el.textContent !== newCountStr) {
			el.textContent = newCountStr;
		}
	}
}
