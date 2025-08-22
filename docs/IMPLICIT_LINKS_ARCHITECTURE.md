# Implicit Links Architecture & Extensibility Guide

## Overview

The Implicit Links system in Strange New Worlds is a modular, extensible architecture that allows automatic detection and creation of virtual links based on text patterns. This document provides a comprehensive guide to understanding the architecture and extending it with custom detectors and providers.

## Core Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Implicit Links System                        │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer (CodeMirror 6)                                       │
│  ├── createInferredLinksExtension()                            │
│  ├── makeChunkPlugin()                                         │
│  └── Visual Decorations                                        │
├─────────────────────────────────────────────────────────────────┤
│  Manager Layer                                                  │
│  ├── ImplicitLinksManager                                      │
│  ├── DetectionManager                                          │
│  └── Virtual Link Providers                                    │
├─────────────────────────────────────────────────────────────────┤
│  Detection Layer                                                │
│  ├── RegexDetector                                             │
│  ├── DictionaryDetector                                        │
│  └── Custom Detectors (extensible)                             │
├─────────────────────────────────────────────────────────────────┤
│  Policy Layer                                                   │
│  ├── WikilinkEquivalencePolicy                                 │
│  └── Reference Counting                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **UI Layer**: Handles visual rendering and user interactions
2. **Manager Layer**: Coordinates detection and provider registration
3. **Detection Layer**: Performs actual text pattern matching
4. **Policy Layer**: Determines link equivalence and reference counting

## Core Interfaces

### ImplicitLinkDetector

The base interface for all detection engines:

```typescript
/**
 * Interface for custom implicit link detectors.
 * 
 * Detectors analyze text content to find potential links that should be created
 * as virtual links in the SNW sidebar.
 */
export interface ImplicitLinkDetector {
  /** 
   * Unique identifier for this detector (e.g., "regex", "dictionary", "custom")
   */
  name: string;
  
  /**
   * Analyze text content to detect potential links.
   * 
   * @param file - The Obsidian file being analyzed
   * @param text - The raw text content of the file (excluding code blocks and existing links)
   * @returns Promise resolving to array of detected links
   * 
   * The text parameter contains the file's content that should be scanned for patterns.
   * This text has already been preprocessed to exclude:
   * - Code blocks (```...```)
   * - Inline code (`...`)
   * - Existing wikilinks ([[...]])
   * - Markdown links ([...](...))
   * 
   * Your detector should scan this clean text for patterns and return any matches
   * that should become virtual links.
   */
  detect(file: TFile, text: string): Promise<DetectedLink[]>;
}
```

### DetectedLink

The standard result format for all detectors:

```typescript
export type DetectedLink = {
  span: TextSpan;           // { start: number, end: number }
  display: string;          // Text to display in UI
  targetPath: string;       // Target file path
  source: "regex" | "dictionary" | string; // Detector identifier
};
```

### VirtualLinkProvider

The interface for custom link providers:

```typescript
export type VirtualLinkProvider = (args: {
  file: TFile;
  cache: CachedMetadata;
  makeLink: (linkText: string, displayText?: string, pos?: Pos) => Link;
}) => Link[] | Promise<Link[]>;
```

## Built-in Detectors

### RegexDetector

**Purpose**: Pattern-based detection using regular expressions

**Configuration**:
```typescript
interface RegexRule {
  pattern: string;               // Regex pattern
  flags: string;                 // Regex flags (e.g., "gi")
  targetTemplate: string;        // Target file template
  displayTemplate?: string;      // Optional display template
}
```

**Template Variables**:
- `${0}` - Full matched text
- `${1}`, `${2}`, etc. - Captured groups

**Example**:
```typescript
{
  pattern: "\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\b",
  flags: "g",
  targetTemplate: "Encyclopedia/${0}.md"
}
```

### DictionaryDetector

**Purpose**: Dictionary-based detection using file names, aliases, and headings

**Configuration**:
```typescript
interface DictionarySettings {
  sources: {
    basenames: boolean;    // File basenames
    aliases: boolean;      // Frontmatter aliases
    headings: boolean;     // Markdown headings
    customList: boolean;   // Custom phrases list
  };
  minPhraseLength: number;
  requireWordBoundaries: boolean;
}
```

**Features**:
- Trie-based matching for performance
- Unicode-aware word boundaries
- Automatic phrase normalization

## Extending the System

### Creating Custom Detectors

To create a custom detector, implement the `ImplicitLinkDetector` interface:

```typescript
// src/implicit-links/detectors/CustomDetector.ts
import type { TFile } from "obsidian";
import type { ImplicitLinkDetector, DetectedLink } from "../../types";

export class CustomDetector implements ImplicitLinkDetector {
  name = "custom";
  
  constructor(private settings: any) {
    // Initialize with your settings
  }
  
  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    const results: DetectedLink[] = [];
    
    // Your detection logic here
    // Example: detect mentions of external APIs
    const apiPattern = /\b[A-Z][a-zA-Z]*API\b/g;
    let match;
    
    while ((match = apiPattern.exec(text)) !== null) {
      results.push({
        span: { start: match.index, end: match.index + match[0].length },
        display: match[0],
        targetPath: `APIs/${match[0]}.md`,
        source: "custom"
      });
    }
    
    return results;
  }
}
```

### Registering Custom Detectors

Update the `DetectionManager` to support your detector:

```typescript
// In DetectionManager.ts
import { CustomDetector } from "./detectors/CustomDetector";

export class DetectionManager {
  private detector: RegexDetector | DictionaryDetector | CustomDetector | null = null;

  constructor(
    private app: App,
    private settings: AutoLinkSettings,
    private policy: WikilinkEquivalencePolicy,
  ) {
    if (settings.detectionMode === "regex") {
      this.detector = new RegexDetector(settings);
    } else if (settings.detectionMode === "dictionary") {
      this.detector = new DictionaryDetector(app, settings, policy);
    } else if (settings.detectionMode === "custom") {
      this.detector = new CustomDetector(settings);
    }
  }
  
  // ... rest of implementation
}
```

### Creating Custom Virtual Link Providers

Virtual link providers can generate links from any source:

```typescript
// Example: Dataview-based provider
const dataviewProvider: VirtualLinkProvider = async ({ file, cache, makeLink }) => {
  const links: Link[] = [];
  
  // Query Dataview for related notes
  const related = await DataviewAPI.query(`
    LIST
    FROM [[${file.basename}]]
    WHERE file.name != "${file.basename}"
  `);
  
  // Convert to links
  for (const result of related.value) {
    links.push(makeLink(result.file.path, result.file.name));
  }
  
  return links;
};

// Register the provider
plugin.snwAPI.registerVirtualLinkProvider(dataviewProvider);
```

### Advanced: Custom UI Extensions

For advanced use cases, you can create custom CodeMirror 6 extensions:

```typescript
// Custom extension for specialized highlighting
import { ViewPlugin, Decoration, DecorationSet } from "@codemirror/view";

export function createCustomHighlightingExtension() {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }
    
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }
    
    buildDecorations(view: EditorView): DecorationSet {
      // Your custom decoration logic
      return Decoration.none;
    }
  }, {
    decorations: v => v.decorations
  });
}
```

## Configuration Management

### Settings Structure

The implicit links system uses a hierarchical settings structure:

```typescript
interface AutoLinkSettings {
  enabledLivePreview: boolean;
  enabledReadingView: boolean;
  detectionMode: "off" | "regex" | "dictionary" | "custom";
  
  // Regex-specific settings
  regexRules: RegexRule[];
  
  // Dictionary-specific settings
  dictionary?: DictionarySettings;
  
  // Custom detector settings
  customDetector?: any;
}
```

### Dynamic Configuration

Settings can be updated at runtime:

```typescript
// Update settings
await plugin.implicitLinksManager.updateSettings(newSettings);

// Trigger refresh
plugin.implicitLinksManager.triggerRefresh();
```

## Performance Considerations

### Caching Strategy

The system uses multiple caching layers:

1. **Phrase Cache**: Stores detected phrases with reference counts
2. **Regex Chunks**: Large regex patterns are split into chunks
3. **Trie Structure**: Dictionary detector uses trie for O(n) matching

### Optimization Techniques

1. **Chunked Processing**: Large phrase sets are processed in chunks (default: 300 phrases)
2. **Debounced Updates**: UI updates are debounced to prevent excessive computation
3. **Lazy Building**: Dictionary detector builds trie on first use
4. **Atomic Updates**: Cache updates are atomic to prevent flicker

### Memory Management

```typescript
// Clean up resources
detector.unload(); // If detector implements cleanup
cache.clear();     // Clear phrase cache
```

## Integration Points

### Policy System Integration

Implicit links integrate with the policy system for reference counting:

```typescript
// Use policy for key generation
const key = policy.generateKey(link);

// Get reference count
const count = getReferenceCount(plugin, key);
```

### UI Integration

Implicit links appear in the SNW sidebar alongside regular links:

```typescript
// Links are automatically included in reference counting
// and appear in the sidebar with proper styling
```

### Event System

The system responds to various events:

```typescript
// File changes trigger refresh
app.vault.on('modify', file => {
  if (file.extension === 'md') {
    triggerRefresh();
  }
});

// Settings changes trigger rebuild
onSettingsChange(newSettings => {
  updateSettings(newSettings);
});
```

## Testing and Debugging

### Testing Custom Detectors

```typescript
// Test your detector
const detector = new CustomDetector(settings);
const results = await detector.detect(file, text);
console.log('Detected links:', results);
```

### Debugging Tools

1. **Console Logging**: Enable debug logging in settings
2. **Visual Indicators**: Links are highlighted in the editor
3. **Reference Counts**: Check sidebar for link counts
4. **Cache Inspection**: Examine phrase cache contents

### Performance Profiling

```typescript
// Profile detection performance
const start = performance.now();
const results = await detector.detect(file, text);
const duration = performance.now() - start;
console.log(`Detection took ${duration}ms`);
```

## Best Practices

### Detector Design

1. **Single Responsibility**: Each detector should have one clear purpose
2. **Performance First**: Optimize for large files and many patterns
3. **Error Handling**: Gracefully handle malformed input
4. **Unicode Support**: Use Unicode-aware patterns when possible

### Provider Design

1. **Async Support**: Return promises for external API calls
2. **Caching**: Cache expensive operations
3. **Error Recovery**: Provide fallback behavior
4. **Resource Cleanup**: Implement proper cleanup methods

### Configuration

1. **Validation**: Validate configuration at startup
2. **Defaults**: Provide sensible defaults
3. **Documentation**: Document all configuration options
4. **Migration**: Support configuration migration between versions

## Migration Guide

### From Old Implementation

The new architecture is backward compatible:

1. **Settings**: Existing settings continue to work
2. **Providers**: Existing providers are automatically supported
3. **UI**: Visual behavior remains the same
4. **Performance**: Improved performance with no breaking changes

### Upgrading Custom Code

If you have custom implicit link code:

1. **Update Interfaces**: Use new `ImplicitLinkDetector` interface
2. **Register Detectors**: Add to `DetectionManager`
3. **Update Settings**: Use new settings structure
4. **Test Thoroughly**: Verify behavior with new architecture

## Future Enhancements

### Planned Features

1. **Machine Learning**: AI-powered link detection
2. **External Services**: Cloud-based detection services
3. **Advanced Patterns**: Support for complex pattern matching
4. **Real-time Collaboration**: Multi-user link detection

### Extension Points

The architecture is designed to support:

1. **Custom Detection Algorithms**: Any text analysis approach
2. **External Data Sources**: APIs, databases, web services
3. **Advanced UI Components**: Custom visualizations
4. **Integration Plugins**: Third-party plugin integration

## Conclusion

The Implicit Links system provides a robust, extensible foundation for automatic link detection. By understanding the architecture and following the extension patterns, you can create powerful custom detectors and providers that integrate seamlessly with the existing system.

For more information, see:
- [Implicit Links User Guide](IMPLICIT_LINKS.md)
- [Policy System Documentation](POLICY_SYSTEM.md)
- [Flicker-Free Implementation](FLICKER_FREE_IMPLICIT_LINKS.md)
