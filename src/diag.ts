/**
 * Diagnostic utilities for development and debugging
 * These are controlled by dev flags in settings and are no-ops in production
 */

export interface DiagnosticFlags {
	diagDecorations: boolean;
	forceLegacy: boolean;
}

let diagnosticFlags: DiagnosticFlags = {
	diagDecorations: true, // Default to true to match settings
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

// Enhanced logging system for startup performance diagnostics
const DEBUG = false; // default false in minimal mode
export const SNW_TAG = "SNW";
export const log = {
	info: (...a: any[]) => console.log(`${SNW_TAG}:`, ...a),
	warn: (...a: any[]) => console.warn(`${SNW_TAG}:`, ...a),
	error: (...a: any[]) => console.error(`${SNW_TAG}:`, ...a),
	debug: (...a: any[]) => { if (DEBUG) console.debug(`${SNW_TAG}:`, ...a); },
	time: (label: string) => console.time(`${SNW_TAG} ⏱ ${label}`),
	timeEnd: (label: string) => console.timeEnd(`${SNW_TAG} ⏱ ${label}`),
	mark: (name: string) => performance.mark(`${SNW_TAG}:${name}`),
	measure: (name: string, start: string, end: string) =>
		performance.measure(`${SNW_TAG}:${name}`, `${SNW_TAG}:${start}`, `${SNW_TAG}:${end}`),
};

/**
 * Progress tracking for long-running operations
 */
export class ProgressTracker {
	private startTime: number;
	private lastLogTime: number;
	private interval: number;

	constructor(private total: number, private label: string, private logInterval: number = 200) {
		this.startTime = Date.now();
		this.lastLogTime = 0;
		this.interval = logInterval;
	}

	update(current: number): void {
		const now = Date.now();
		if (now - this.lastLogTime >= this.interval) {
			const elapsed = now - this.startTime;
			const rate = current / (elapsed / 1000);
			const remaining = (this.total - current) / rate;
			
			log.debug(`${this.label}: ${current}/${this.total} (${Math.round(current/this.total*100)}%) - ${Math.round(rate)}/s, ~${Math.round(remaining)}s remaining`);
			this.lastLogTime = now;
		}
	}

	complete(): void {
		const totalTime = Date.now() - this.startTime;
		log.info(`${this.label}: completed in ${totalTime}ms`);
	}
}

/**
 * Yield to UI thread to prevent freezing during long operations
 */
export async function yieldToUI(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 0));
}
