/**
 * Custom Detector Example for Implicit Links
 * 
 * This example demonstrates how to create a custom detector that:
 * 1. Detects mentions of external APIs and libraries
 * 2. Integrates with the existing implicit links system
 * 3. Provides configuration options
 * 4. Handles performance optimization
 */

import type { TFile } from "obsidian";
import type { ImplicitLinkDetector, DetectedLink } from "../src/types";

// Configuration interface for the custom detector
interface APIDetectorSettings {
  enabled: boolean;
  patterns: Array<{
    name: string;
    pattern: string;
    flags: string;
    targetTemplate: string;
    displayTemplate?: string;
  }>;
  minLength: number;
  caseInsensitive: boolean;
}

// Default configuration
const DEFAULT_API_DETECTOR_SETTINGS: APIDetectorSettings = {
  enabled: true,
  patterns: [
    {
      name: "JavaScript APIs",
      pattern: "\\b[A-Z][a-zA-Z]*API\\b",
      flags: "g",
      targetTemplate: "APIs/${0}.md",
      displayTemplate: "🔌 ${0}"
    },
    {
      name: "Python Libraries",
      pattern: "\\b[a-z_]+\\b",
      flags: "g",
      targetTemplate: "Python/${0}.md",
      displayTemplate: "🐍 ${0}"
    },
    {
      name: "GitHub Repositories",
      pattern: "\\b[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+\\b",
      flags: "g",
      targetTemplate: "GitHub/${0}.md",
      displayTemplate: "📦 ${0}"
    }
  ],
  minLength: 3,
  caseInsensitive: true
};

/**
 * Custom detector for API and library mentions
 * 
 * This detector scans clean text content (excluding code blocks and existing links)
 * to find mentions of APIs, libraries, and other technical terms.
 */
export class APIDetector implements ImplicitLinkDetector {
  name = "api-detector";
  private settings: APIDetectorSettings;
  private compiledPatterns: Array<{
    name: string;
    regex: RegExp;
    targetTemplate: string;
    displayTemplate?: string;
  }> = [];

  constructor(settings: Partial<APIDetectorSettings> = {}) {
    this.settings = { ...DEFAULT_API_DETECTOR_SETTINGS, ...settings };
    this.compilePatterns();
  }

  /**
   * Compile regex patterns for performance
   */
  private compilePatterns(): void {
    this.compiledPatterns = this.settings.patterns.map(pattern => ({
      name: pattern.name,
      regex: new RegExp(pattern.pattern, pattern.flags),
      targetTemplate: pattern.targetTemplate,
      displayTemplate: pattern.displayTemplate
    }));
  }

  /**
   * Main detection method
   * 
   * Analyzes the provided text content to find API and library mentions.
   * The text parameter contains clean content (code blocks and existing links removed).
   */
  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    if (!this.settings.enabled) {
      return [];
    }

    const results: DetectedLink[] = [];
    const seenSpans = new Set<string>(); // Prevent duplicates

    for (const pattern of this.compiledPatterns) {
      let match: RegExpExecArray | null;
      pattern.regex.lastIndex = 0; // Reset regex state

      while ((match = pattern.regex.exec(text)) !== null) {
        const matchedText = match[0];
        
        // Skip if too short
        if (matchedText.length < this.settings.minLength) {
          continue;
        }

        // Skip if already seen (overlapping matches)
        const spanKey = `${match.index}-${match.index + matchedText.length}`;
        if (seenSpans.has(spanKey)) {
          continue;
        }

        // Generate target path and display text
        const targetPath = this.applyTemplate(pattern.targetTemplate, match);
        const display = pattern.displayTemplate 
          ? this.applyTemplate(pattern.displayTemplate, match)
          : matchedText;

        results.push({
          span: { 
            start: match.index, 
            end: match.index + matchedText.length 
          },
          display,
          targetPath,
          source: this.name
        });

        seenSpans.add(spanKey);
      }
    }

    return this.resolveConflicts(results);
  }

  /**
   * Apply template with captured groups
   */
  private applyTemplate(template: string, match: RegExpExecArray): string {
    return template.replace(/\$\{(\d+)\}/g, (_, groupIndex) => {
      const index = parseInt(groupIndex);
      return match[index] || '';
    });
  }

  /**
   * Resolve overlapping matches (longest wins)
   */
  private resolveConflicts(detections: DetectedLink[]): DetectedLink[] {
    // Sort by length (longest first) then by position
    detections.sort((a, b) => {
      const aLength = a.span.end - a.span.start;
      const bLength = b.span.end - b.span.start;
      
      if (aLength !== bLength) {
        return bLength - aLength; // Longer first
      }
      
      return a.span.start - b.span.start; // Earlier first
    });

    const resolved: DetectedLink[] = [];
    let lastEnd = -1;

    for (const detection of detections) {
      if (detection.span.start >= lastEnd) {
        resolved.push(detection);
        lastEnd = detection.span.end;
      }
    }

    return resolved;
  }

  /**
   * Update settings and recompile patterns
   */
  updateSettings(settings: Partial<APIDetectorSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.compilePatterns();
  }

  /**
   * Get current settings
   */
  getSettings(): APIDetectorSettings {
    return { ...this.settings };
  }

  /**
   * Clean up resources
   */
  unload(): void {
    this.compiledPatterns = [];
  }
}

/**
 * Example: How to integrate the custom detector
 */
export function integrateCustomDetector() {
  // 1. Create the detector
  const apiDetector = new APIDetector({
    patterns: [
      {
        name: "React Hooks",
        pattern: "\\buse[A-Z][a-zA-Z]*\\b",
        flags: "g",
        targetTemplate: "React/Hooks/${0}.md",
        displayTemplate: "⚛️ ${0}"
      }
    ]
  });

  // 2. Test the detector
  const testText = `
    I'm using useState and useEffect in my React component.
    The useCallback hook helps with performance optimization.
    Don't forget to import useMemo from React.
  `;

  // 3. Use the detector (this would be done in DetectionManager)
  apiDetector.detect({} as TFile, testText).then(results => {
    console.log('Detected API mentions:', results);
  });
}

/**
 * Example: Advanced detector with caching
 */
export class CachedAPIDetector extends APIDetector {
  private cache = new Map<string, DetectedLink[]>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    const cacheKey = `${file.path}-${text.length}`;
    const now = Date.now();
    const timestamp = this.cacheTimestamps.get(cacheKey);

    // Check cache
    if (timestamp && (now - timestamp) < this.cacheTimeout) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Perform detection
    const results = await super.detect(file, text);

    // Cache results
    this.cache.set(cacheKey, results);
    this.cacheTimestamps.set(cacheKey, now);

    // Clean old cache entries
    this.cleanCache();

    return results;
  }

  private cleanCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, timestamp] of this.cacheTimestamps) {
      if ((now - timestamp) > this.cacheTimeout) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }
  }

  unload(): void {
    super.unload();
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

/**
 * Example: How to register the detector in DetectionManager
 */
export function registerCustomDetector() {
  // This would be added to DetectionManager.ts
  /*
  import { APIDetector } from "./detectors/APIDetector";

  export class DetectionManager {
    private detector: RegexDetector | DictionaryDetector | APIDetector | null = null;

    constructor(
      private app: App,
      private settings: AutoLinkSettings,
      private policy: WikilinkEquivalencePolicy,
    ) {
      if (settings.detectionMode === "regex") {
        this.detector = new RegexDetector(settings);
      } else if (settings.detectionMode === "dictionary") {
        this.detector = new DictionaryDetector(app, settings, policy);
      } else if (settings.detectionMode === "api") {
        this.detector = new APIDetector(settings.apiDetector);
      }
    }
    
    // ... rest of implementation
  }
  */
}

/**
 * Example: Settings integration
 */
export interface ExtendedAutoLinkSettings {
  detectionMode: "off" | "regex" | "dictionary" | "api";
  apiDetector?: APIDetectorSettings;
  // ... other existing settings
}

/**
 * Example: Usage in a plugin
 */
export function examplePluginUsage() {
  // 1. Create detector with custom settings
  const detector = new APIDetector({
    patterns: [
      {
        name: "Custom APIs",
        pattern: "\\bMyAPI\\b",
        flags: "gi",
        targetTemplate: "Custom/${0}.md",
        displayTemplate: "🎯 ${0}"
      }
    ]
  });

  // 2. Test with sample text
  const sampleText = "I'm using MyAPI for data processing.";
  
  detector.detect({} as TFile, sampleText).then(results => {
    console.log('Results:', results);
    // Expected: [{ span: { start: 12, end: 17 }, display: "🎯 MyAPI", targetPath: "Custom/MyAPI.md", source: "api-detector" }]
  });

  // 3. Update settings dynamically
  detector.updateSettings({
    patterns: [
      {
        name: "Updated Pattern",
        pattern: "\\bNewAPI\\b",
        flags: "gi",
        targetTemplate: "Updated/${0}.md"
      }
    ]
  });

  // 4. Clean up
  detector.unload();
}
