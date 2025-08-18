# Implicit Links Feature

The Implicit Links feature allows you to automatically detect and create virtual links in your Obsidian vault based on regex patterns. This is useful for creating automatic references to concepts, terms, or files without manually adding explicit wikilinks.

## How It Works

1. **Detection**: The system scans your markdown files for text that matches configured regex patterns
2. **Virtual Links**: Matches are converted into virtual links that appear in the SNW sidebar
3. **Policy Integration**: Virtual links are processed through the same equivalence policies as regular wikilinks
4. **Conflict Resolution**: When multiple patterns match overlapping text, the longest match wins

## Configuration

### Settings Structure

```typescript
interface AutoLinkSettings {
  enabledLivePreview: boolean;     // Show implicit links in live preview
  enabledReadingView: boolean;     // Show implicit links in reading view  
  detectionMode: "off" | "regex" | "dictionary";  // Detection mode (default: "off")
  regexRules: Array<{
    pattern: string;               // Regex pattern to match
    flags: string;                 // Regex flags (e.g., "gi")
    targetTemplate: string;        // Target file path template
    displayTemplate?: string;      // Optional display text template
  }>;
  dictionary?: {
    sources: {
      basenames: boolean;   // Note basenames (default: true)
      aliases: boolean;     // frontmatter aliases[] (default: true)
      headings: boolean;    // Markdown headings in each note (default: false)
    };
    minPhraseLength: number; // characters; ignore very short keys (default: 3)
    requireWordBoundaries: boolean; // only match as whole words (default: true)
  };
}
```

### Example Configuration

```json
{
  "detectionMode": "regex",
  "regexRules": [
    {
      "pattern": "\\bNatural Language Programming\\b",
      "flags": "gi",
      "targetTemplate": "Encyclopedia/${0}.md"
    },
    {
      "pattern": "\\bMachine Learning\\b", 
      "flags": "gi",
      "targetTemplate": "AI/${0}.md",
      "displayTemplate": "ML: ${0}"
    }
  ]
}
```

## Template Variables

- `${0}` - The full matched text
- `${1}`, `${2}`, etc. - Captured groups from the regex pattern

## Example Use Cases

### 1. Encyclopedia References
```json
{
  "pattern": "\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\b",
  "flags": "g",
  "targetTemplate": "Encyclopedia/${0}.md"
}
```

### 2. Code References
```json
{
  "pattern": "\\b([A-Z][a-zA-Z0-9]*\\.(?:js|ts|py|java))\\b",
  "flags": "g", 
  "targetTemplate": "Code/${0}",
  "displayTemplate": "📄 ${0}"
}
```

### 3. Date References
```json
{
  "pattern": "\\b(\\d{4}-\\d{2}-\\d{2})\\b",
  "flags": "g",
  "targetTemplate": "Daily/${0}.md",
  "displayTemplate": "📅 ${0}"
}
```

### 4. Dictionary-Based Detection
```json
{
  "detectionMode": "dictionary",
  "dictionary": {
    "sources": {
      "basenames": true,
      "aliases": true,
      "headings": false
    },
    "minPhraseLength": 3,
    "requireWordBoundaries": true
  }
}
```

This automatically detects mentions of note names and aliases in your text and creates virtual links to those notes.

## Behavior

- **Default**: Detection is off by default to preserve existing behavior
- **Performance**: Detection runs when files are processed by SNW
- **Exclusions**: Code blocks and existing links are excluded from detection
- **Policies**: Virtual links respect the same equivalence policies as regular links
- **UI**: Virtual links appear in the SNW sidebar alongside regular links

## Limitations

- Only regex-based detection is currently implemented
- Detection is limited to plain text (excludes code blocks, existing links)
- Virtual links are not persisted to the markdown files
- Performance impact scales with number of regex rules and file size

## Future Enhancements

- Dictionary-based detection
- External service integration
- More sophisticated conflict resolution
- Persistent link materialization
- Advanced text preprocessing
