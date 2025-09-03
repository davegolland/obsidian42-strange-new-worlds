import type SNWPlugin from "../main";
import { log } from "../diag";

// A plugin reference to be set during initialization
let plugin: SNWPlugin;

/**
 * Sets the plugin instance for this module
 * @param snwPlugin The plugin instance
 */
export function setPluginVariableForDebouncedHelpers(snwPlugin: SNWPlugin) {
	plugin = snwPlugin;
}

/**
 * Update header reference counts (debounced)
 */
export function updateHeadersDebounce() {
	if (plugin?.updateHeadersDebounced) {
		log.debug("debounced: updateHeadersDebounced fired");
		plugin.updateHeadersDebounced();
	}
}

/**
 * Update frontmatter properties reference counts (debounced)
 */
export function updatePropertiesDebounce() {
	if (plugin?.updatePropertiesDebounced) {
		log.debug("debounced: updatePropertiesDebounced fired");
		plugin.updatePropertiesDebounced();
	}
}

/**
 * Update all live references in the document (debounced)
 */
export function updateAllSnwLiveUpdateReferencesDebounce() {
	if (plugin?.updateAllSnwLiveUpdateReferencesDebounced) {
		log.debug("debounced: updateAllSnwLiveUpdateReferencesDebounced fired");
		plugin.updateAllSnwLiveUpdateReferencesDebounced();
	}
}
