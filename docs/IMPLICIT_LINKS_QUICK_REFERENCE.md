# Implicit Links Quick Reference

## Core Interfaces

### ImplicitLinkDetector
```typescript
/**
 * Interface for custom implicit link detectors.
 * 
 * Detectors analyze text content to find potential links that should be created
 * as virtual links in the SNW sidebar.
 */
interface ImplicitLinkDetector {
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
```typescript
type DetectedLink = {
  span: TextSpan;           // { start: number, end: number }
  display: string;          // Text to display in UI
  targetPath: string;       // Target file path
  source: string;           // Detector identifier
};
```

### VirtualLinkProvider
```typescript
type VirtualLinkProvider = (args: {
  file: TFile;
  cache: CachedMetadata;
  makeLink: (linkText: string, displayText?: string, pos?: Pos) => Link;
}) => Link[] | Promise<Link[]>;
```

## Built-in Detectors

### RegexDetector
- **Purpose**: Pattern-based detection
- **Configuration**: `regexRules[]` with pattern, flags, templates
- **Template Variables**: `${0}`, `${1}`, etc.

### DictionaryDetector
- **Purpose**: Dictionary-based detection
- **Sources**: basenames, aliases, headings, custom phrases
- **Features**: Trie-based matching, Unicode support

## Extension Points

### 1. Custom Detectors
```typescript
export class CustomDetector implements ImplicitLinkDetector {
  name = "custom";
  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    // Your detection logic
    return results;
  }
}
```

### 2. Custom Providers
```typescript
const customProvider: VirtualLinkProvider = async ({ file, cache, makeLink }) => {
  // Generate links from any source
  return links;
};
```

### 3. Custom UI Extensions
```typescript
export function createCustomExtension() {
  return ViewPlugin.fromClass(class {
    // Custom CodeMirror 6 extension
  });
}
```

## Configuration Structure

```typescript
interface AutoLinkSettings {
  enabledLivePreview: boolean;
  enabledReadingView: boolean;
  detectionMode: "off" | "regex" | "dictionary" | "custom";
  regexRules: RegexRule[];
  dictionary?: DictionarySettings;
  customDetector?: any;
}
```

## Integration Points

### Policy System
```typescript
// Use policy for key generation
const key = policy.generateKey(link);
const count = getReferenceCount(plugin, key);
```

### UI System
```typescript
// Register provider
plugin.snwAPI.registerVirtualLinkProvider(provider);

// Trigger refresh
plugin.implicitLinksManager.triggerRefresh();
```

### Event System
```typescript
// File changes
app.vault.on('modify', file => triggerRefresh());

// Settings changes
onSettingsChange(newSettings => updateSettings(newSettings));
```

## Performance Patterns

### Caching
```typescript
class CachedDetector extends BaseDetector {
  private cache = new Map<string, DetectedLink[]>();
  
  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    const cacheKey = `${file.path}-${text.length}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    
    const results = await super.detect(file, text);
    this.cache.set(cacheKey, results);
    return results;
  }
}
```

### Chunked Processing
```typescript
// Split large patterns into chunks
const chunks = buildPhraseRegexChunks(phrases, {
  maxPerChunk: 300,
  boundaryMode: "word",
  caseInsensitive: true
});
```

### Debounced Updates
```typescript
const debouncedRefresh = debounce(async (view: EditorView) => {
  // Refresh logic
}, 120);
```

## Common Patterns

### Technology Terms
```regex
\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b
```

### Code References
```regex
`([^`]+)`
```

### Dates
```regex
\b(\d{4}-\d{2}-\d{2})\b
```

### API Names
```regex
\b[A-Z][a-zA-Z]*API\b
```

## Template Variables

- `${0}` - Full matched text
- `${1}`, `${2}`, etc. - Captured groups
- `${file.basename}` - Current file basename
- `${file.path}` - Current file path

## Error Handling

### Detector Errors
```typescript
async detect(file: TFile, text: string): Promise<DetectedLink[]> {
  try {
    // Detection logic
    return results;
  } catch (error) {
    console.warn(`[${this.name}] Detection error:`, error);
    return [];
  }
}
```

### Provider Errors
```typescript
const provider: VirtualLinkProvider = async ({ file, cache, makeLink }) => {
  try {
    // Provider logic
    return links;
  } catch (error) {
    console.warn('[CustomProvider] Error:', error);
    return [];
  }
};
```

## Testing

### Unit Testing
```typescript
const detector = new CustomDetector(settings);
const results = await detector.detect(file, text);
expect(results).toHaveLength(1);
expect(results[0].display).toBe('Expected Text');
```

### Integration Testing
```typescript
// Test with actual plugin
const plugin = new SNWPlugin();
await plugin.implicitLinksManager.updateSettings(settings);
const links = await plugin.implicitLinksManager.detect(file, text);
```

## Debugging

### Console Logging
```typescript
console.log('[CustomDetector] Detected:', results);
console.log('[CustomDetector] Settings:', this.settings);
```

### Visual Debugging
- Check browser console for errors
- Verify decorations are applied
- Test click handlers work
- Check reference counts in sidebar

## Best Practices

### Detector Design
1. **Single Responsibility**: One clear purpose per detector
2. **Performance First**: Optimize for large files
3. **Error Handling**: Graceful failure
4. **Unicode Support**: Use Unicode-aware patterns

### Provider Design
1. **Async Support**: Return promises for external calls
2. **Caching**: Cache expensive operations
3. **Error Recovery**: Provide fallback behavior
4. **Resource Cleanup**: Implement unload()

### Configuration
1. **Validation**: Validate at startup
2. **Defaults**: Provide sensible defaults
3. **Documentation**: Document all options
4. **Migration**: Support config migration

## File Structure

```
src/implicit-links/
├── index.ts                 # Main exports
├── ImplicitLinksManager.ts  # Main manager
├── DetectionManager.ts      # Detector coordination
├── RegexDetector.ts         # Regex-based detection
├── DictionaryDetector.ts    # Dictionary-based detection
├── manager.ts              # UI integration
├── cache.ts                # Phrase caching
├── regex.ts                # Regex utilities
├── decorators.ts           # Visual decorations
├── utils.ts                # Shared utilities
└── shared-utils.ts         # Cross-module utilities
```

## Related Files

- **[Architecture Guide](IMPLICIT_LINKS_ARCHITECTURE.md)** - Detailed architecture documentation
- **[Policy System](POLICY_SYSTEM.md)** - Policy integration
- **[Examples](../examples/)** - Practical examples
- **[Types](../src/types.ts)** - TypeScript definitions
