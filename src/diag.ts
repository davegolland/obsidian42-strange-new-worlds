/**
 * Diagnostic utilities for development and debugging
 * These are controlled by dev flags in settings and are no-ops in production
 */

export interface DiagnosticFlags {
	diagDecorations: boolean;
	forceLegacy: boolean;
}

let diagnosticFlags: DiagnosticFlags = {
	diagDecorations: false,
	forceLegacy: false,
};

/**
 * Set diagnostic flags from settings
 */
export function setDiagnosticFlags(flags: DiagnosticFlags): void {
	diagnosticFlags = { ...flags };
}

/**
 * Get current diagnostic flags
 */
export function getDiagnosticFlags(): DiagnosticFlags {
	return diagnosticFlags;
}

/**
 * Log decoration events when diagnostics are enabled
 */
export function logDecoration(event: string, span: { from: number; to: number }, kind: string): void {
	if (!diagnosticFlags.diagDecorations) return;

	console.log(`[SNW-DIAG] ${event}:`, {
		span,
		kind,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Check if legacy mode is forced
 */
export function isLegacyForced(): boolean {
	return diagnosticFlags.forceLegacy;
}
