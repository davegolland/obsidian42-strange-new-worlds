import type SNWPlugin from "../main";

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
        plugin.updateHeadersDebounced();
    }
}

/**
 * Update frontmatter properties reference counts (debounced)
 */
export function updatePropertiesDebounce() {
    if (plugin?.updatePropertiesDebounced) {
        plugin.updatePropertiesDebounced();
    }
}

/**
 * Update all live references in the document (debounced)
 */
export function updateAllSnwLiveUpdateReferencesDebounce() {
    if (plugin?.updateAllSnwLiveUpdateReferencesDebounced) {
        plugin.updateAllSnwLiveUpdateReferencesDebounced();
    }
} 