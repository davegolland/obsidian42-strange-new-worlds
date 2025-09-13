# Implicit Links Examples

This directory contains practical examples demonstrating how to use and extend the Implicit Links system in Strange New Worlds.

## Examples Overview

### User-Facing Examples

#### [implicit-links-demo.md](./implicit-links-demo.md)
A demonstration file showing various types of implicit links that can be detected:
- Technology terms (Natural Language Programming, Machine Learning)
- Code references (`main.ts`, `settings.ts`)
- Date references (2024-01-15)
- Custom terms (Obsidian42 Strange New Worlds)

**Use Case**: Test your implicit links configuration and see how different patterns work.

#### [custom-phrases-demo.md](./custom-phrases-demo.md)
Shows how to use custom phrases for dictionary-based detection:
- Project names and acronyms
- Technical terms
- Personal references
- Multi-word phrases

**Use Case**: Learn how to configure custom phrases for automatic detection.

#### [dictionary-demo.md](./dictionary-demo.md)
Demonstrates dictionary-based detection using:
- File basenames
- Frontmatter aliases
- Markdown headings
- Custom phrase lists

**Use Case**: Understand how dictionary detection works with your vault structure.

#### [Enterprise.md](./Enterprise.md)
A simple example showing enterprise-related terms and concepts.

### Developer Examples

#### [custom-detector-example.ts](./custom-detector-example.ts)
A comprehensive example showing how to create custom detectors:

**Features Demonstrated**:
- Implementing the `ImplicitLinkDetector` interface
- Configuration management with TypeScript interfaces
- Performance optimization with pattern compilation
- Conflict resolution for overlapping matches
- Caching strategies for better performance
- Integration with the existing system

**Key Components**:
```typescript
// Basic detector implementation
export class APIDetector implements ImplicitLinkDetector {
  name = "api-detector";
  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    // Your detection logic here
  }
}

// Advanced detector with caching
export class CachedAPIDetector extends APIDetector {
  // Caching implementation
}
```

**Use Case**: Learn how to extend the system with custom detection logic.

## How to Use These Examples

### For Users

1. **Copy the demo files** to your vault
2. **Configure implicit links** in InferredWikilinks settings
3. **Test the patterns** by viewing the files in Obsidian
4. **Customize the patterns** for your own use cases

### For Developers

1. **Study the architecture** in `custom-detector-example.ts`
2. **Implement your own detector** following the patterns
3. **Test with the demo files** to verify functionality
4. **Integrate with your plugin** using the provided interfaces

## Configuration Examples

### Regex-Based Detection

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
      "pattern": "\\b([A-Z][a-zA-Z]*API)\\b",
      "flags": "g",
      "targetTemplate": "APIs/${1}.md",
      "displayTemplate": "🔌 ${1}"
    }
  ]
}
```

### Dictionary-Based Detection

```json
{
  "detectionMode": "dictionary",
  "dictionary": {
    "sources": {
      "basenames": true,
      "aliases": true,
      "headings": false,
      "customList": true
    },
    "minPhraseLength": 3,
    "requireWordBoundaries": true
  }
}
```

### Custom Phrases

```json
{
  "dictionary": {
    "customPhrases": [
      "Strange New Worlds",
      "Virtual Link Provider",
      "Policy System",
      "Reference Counting"
    ]
  }
}
```

## Testing Your Configuration

### Step 1: Enable Implicit Links
1. Open InferredWikilinks settings
2. Navigate to "Implicit Links" section
3. Set detection mode to "regex" or "dictionary"
4. Configure your patterns or dictionary settings

### Step 2: Test with Demo Files
1. Open one of the demo files in this directory
2. Look for highlighted text (implicit links)
3. Check the InferredWikilinks sidebar for virtual links
4. Click on links to verify navigation

### Step 3: Debug Issues
1. Open browser console (Ctrl+Shift+I)
2. Look for InferredWikilinks-related log messages
3. Check that patterns match your text
4. Verify target files exist in your vault

## Common Patterns

### Technology Terms
```regex
\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b
```
Matches: "Natural Language Programming", "Machine Learning"

### Code References
```regex
`([^`]+)`
```
Matches: `main.ts`, `settings.ts`

### Dates
```regex
\b(\d{4}-\d{2}-\d{2})\b
```
Matches: 2024-01-15, 2024-01-20

### API Names
```regex
\b[A-Z][a-zA-Z]*API\b
```
Matches: ReactAPI, GraphQLAPI

### GitHub Repositories
```regex
\b[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+\b
```
Matches: obsidian42/strange-new-worlds

## Performance Tips

### For Large Vaults
1. **Use dictionary mode** for better performance
2. **Limit custom phrases** to essential terms
3. **Use word boundaries** to reduce false positives
4. **Set minimum phrase length** to 3+ characters

### For Complex Patterns
1. **Test patterns** with regex testers first
2. **Use captured groups** for flexible templates
3. **Avoid overly broad patterns** that match too much
4. **Consider performance impact** of complex regex

### For Custom Detectors
1. **Implement caching** for expensive operations
2. **Use efficient data structures** (trie for dictionary)
3. **Batch operations** when possible
4. **Clean up resources** in unload() method

## Troubleshooting

### Links Not Appearing
- Check that detection mode is enabled
- Verify patterns match your text
- Ensure target files exist
- Check minimum reference count threshold

### Performance Issues
- Reduce number of regex rules
- Use dictionary mode instead of regex
- Limit custom phrases list
- Check for infinite regex loops

### Visual Issues
- Verify CSS classes are styled
- Check that decorations are applied
- Ensure click handlers work
- Test in both live preview and reading view

## Next Steps

After exploring these examples:

1. **Read the Architecture Guide**: [IMPLICIT_LINKS_ARCHITECTURE.md](../docs/IMPLICIT_LINKS_ARCHITECTURE.md)
2. **Study the Policy System**: [POLICY_SYSTEM.md](../docs/POLICY_SYSTEM.md)
3. **Learn about Flicker-Free Implementation**: [FLICKER_FREE_IMPLICIT_LINKS.md](../docs/FLICKER_FREE_IMPLICIT_LINKS.md)
4. **Create your own detectors** using the provided examples
5. **Share your patterns** with the community

## Contributing

If you create useful patterns or detectors:

1. **Document your approach** with examples
2. **Test thoroughly** with different file types
3. **Consider performance implications**
4. **Share in the community** for others to benefit

## Support

For questions or issues:

1. **Check the documentation** in the `docs/` directory
2. **Review existing examples** for similar use cases
3. **Test with demo files** to isolate issues
4. **Report bugs** with reproducible examples
