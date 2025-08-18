import type { TFile } from "obsidian";
import type { ImplicitLinkDetector, DetectedLink, TextSpan } from "../types";
import type { AutoLinkSettings } from "../settings";

function tmpl(s: string, match: RegExpMatchArray): string {
	return s.replace(/\$\{(\d+)\}/g, (_, g) => match[Number(g)] ?? "");
}

export class RegexDetector implements ImplicitLinkDetector {
	name = "regex";
	private rules: { re: RegExp; targetTemplate: string; displayTemplate?: string }[];

	constructor(private settings: AutoLinkSettings) {
		this.rules = settings.regexRules.map(r => ({
			re: new RegExp(r.pattern, r.flags),
			targetTemplate: r.targetTemplate,
			displayTemplate: r.displayTemplate,
		}));
	}

	async detect(file: TFile, text: string): Promise<DetectedLink[]> {
		const results: DetectedLink[] = [];
		for (const rule of this.rules) {
			let match: RegExpExecArray | null;
			rule.re.lastIndex = 0;
			while ((match = rule.re.exec(text)) !== null) {
				const span: TextSpan = { start: match.index, end: match.index + match[0].length };
				const display = rule.displayTemplate ? tmpl(rule.displayTemplate, match) : match[0];
				const targetPath = tmpl(rule.targetTemplate, match);
				results.push({ span, display, targetPath, source: "regex" });
			}
		}
		return results;
	}
}
