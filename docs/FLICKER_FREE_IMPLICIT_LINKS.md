# Flicker-Free Implicit Links Implementation

## Overview

This document describes the new flicker-free implicit links implementation that addresses the "only matches on its own line" issue and provides smooth, instant updates during editing.

## Key Improvements

### 1. Phrase-Aware Regex Building
- **Problem**: Old implementation used simple token regex that only matched individual words
- **Solution**: New system builds phrase-aware regex patterns that can match multi-word phrases within sentences
- **Example**: "Natural Language Processing" now matches in "I love Natural Language Processing techniques"

### 2. Unicode-Aware Word Boundaries
- **Problem**: Simple word boundaries (`\b`) don't work well with Unicode characters
- **Solution**: Uses Unicode-aware boundaries (`\p{L}`) for proper phrase matching
- **Result**: Better internationalization support and more accurate phrase detection

### 3. Chunked Processing
- **Problem**: Large phrase sets create massive regex patterns that are slow to execute
- **Solution**: Automatically chunks phrases into smaller regex patterns (default: 300 phrases per chunk)
- **Result**: Maintains performance even with thousands of custom phrases

### 4. Atomic Cache Updates
- **Problem**: Async provider updates caused flickering as decorations were removed and re-added
- **Solution**: Atomic cache updates with version stamps prevent flicker during async operations
- **Result**: Smooth, flicker-free updates during editing

### 5. MatchDecorator Integration
- **Problem**: Manual decoration management caused position mapping issues on edits
- **Solution**: Uses CodeMirror 6's MatchDecorator for instant position mapping
- **Result**: Decorations update instantly as you type, with no lag or flicker

## Technical Architecture

### Core Components

1. **Cache System** (`src/implicit-links/cache.ts`)
   - Manages phrase information and reference counts
   - Provides atomic updates to prevent flicker
   - Version stamps for detecting phrase set changes

2. **Regex Builder** (`src/implicit-links/regex.ts`)
   - Builds phrase-aware regex patterns
   - Handles Unicode word boundaries
   - Chunks large phrase sets for performance

3. **Decorators** (`src/implicit-links/decorators.ts`)
   - Creates visual decorations for matched phrases
   - Integrates with existing hover system
   - Handles click navigation

4. **Manager** (`src/implicit-links/manager.ts`)
   - Coordinates all components
   - Manages async provider integration
   - Handles debounced updates

### Integration Points

- **Existing Provider System**: Works with current virtual link providers
- **Settings Integration**: Respects all existing implicit link settings
- **Reference Counting**: Uses native SNW reference counting system
- **Hover System**: Integrates with existing reference hover functionality

## Configuration

The new implementation respects all existing settings:

```typescript
// Example configuration
{
  boundaryMode: "word",        // "word" | "loose" | "none"
  caseInsensitive: true,       // Case-insensitive matching
  maxPerChunk: 300,           // Phrases per regex chunk
  debounceMs: 120             // Update debounce interval
}
```

## Performance Characteristics

- **Memory**: Minimal overhead, uses efficient Map structures
- **CPU**: Chunked regex processing prevents performance degradation
- **Updates**: Instant position mapping with MatchDecorator
- **Async**: Debounced provider updates prevent excessive computation

## Testing

Run the test script to verify functionality:

```bash
node scripts/test-flicker-free-implicit-links.js
```

This tests:
- Regex pattern generation
- Phrase matching within sentences
- Cache structure and lookups
- Phrase processing logic

## Migration

The new implementation is a drop-in replacement for the existing system:

1. **No Breaking Changes**: All existing settings and APIs remain compatible
2. **Automatic Integration**: Uses existing provider system and settings
3. **Backward Compatible**: Works with existing custom phrases and configurations

## Benefits

1. **Better UX**: No more flickering during editing
2. **Improved Accuracy**: Phrases match within sentences, not just alone
3. **Better Performance**: Chunked processing handles large phrase sets efficiently
4. **Unicode Support**: Proper handling of international characters
5. **Future-Proof**: Built on modern CodeMirror 6 patterns

## Troubleshooting

### Phrases Not Matching
- Check that phrases are added to custom phrases list
- Verify minimum phrase length setting
- Ensure word boundaries are enabled if needed

### Performance Issues
- Reduce `maxPerChunk` setting for very large phrase sets
- Increase `debounceMs` for slower updates
- Check provider performance if using custom providers

### Visual Issues
- Verify CSS classes are properly styled
- Check that hover system is working
- Ensure click handlers are properly bound

## Future Enhancements

Potential improvements for future versions:
- Overlapping phrase support (both "world" and "hello world" match)
- Advanced boundary modes for specific use cases
- Performance profiling and optimization
- Enhanced debugging tools
