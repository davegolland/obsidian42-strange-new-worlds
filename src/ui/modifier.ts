import { Keymap } from "obsidian";

/**
 * Centralized helper for checking if modifier key requirements are met
 * @param requireMod - Whether a modifier key is required
 * @param e - The mouse or pointer event
 * @returns true if the event passes the modifier gate
 */
export const passesHoverGate = (requireMod: boolean, e: MouseEvent | PointerEvent): boolean => {
	return !requireMod || Keymap.isModifier(e, "Mod");
};
