# Virtual Links Example

This document demonstrates how to use the new Virtual Links feature in Strange New Worlds (SNW).

## Overview

Virtual Links allow other plugins or snippets to register providers that return additional dynamic links for files. These links are indexed by SNW just like regular wikilinks, appearing in reference counts, gutters, and the sidebar.

## Basic Usage

### Registering a Provider

```typescript
// Register a virtual link provider
const unregister = window.snwAPI!.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
    // Your provider logic here
    return [];
});

// Later, unregister when done
unregister();
```

### Example: Frontmatter Links

This example treats YAML frontmatter properties as links:

```typescript
const unregister = window.snwAPI!.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
    const links: any[] = [];
    
    // Check if file has frontmatter
    if (cache?.frontmatter) {
        // Treat 'related' property as links
        if (Array.isArray(cache.frontmatter.related)) {
            cache.frontmatter.related.forEach((noteName: string) => {
                links.push(makeLink(String(noteName), `Related: ${noteName}`));
            });
        }
        
        // Treat 'tags' property as links to tag pages
        if (Array.isArray(cache.frontmatter.tags)) {
            cache.frontmatter.tags.forEach((tag: string) => {
                links.push(makeLink(`tags/${tag}`, `Tag: ${tag}`));
            });
        }
    }
    
    return links;
});
```

### Example: Computed Relationships

This example creates links based on file content analysis:

```typescript
const unregister = window.snwAPI!.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
    const links: any[] = [];
    
    // Create links based on file path patterns
    if (file.path.startsWith('projects/')) {
        // Link to project template
        links.push(makeLink('templates/project', 'Project Template'));
        
        // Link to project overview
        links.push(makeLink('projects/overview', 'Projects Overview'));
    }
    
    // Create links based on file content
    if (cache?.sections) {
        cache.sections.forEach((section: any) => {
            if (section.type === 'list') {
                // Link list items to their respective pages
                section.items?.forEach((item: any) => {
                    if (item.task) {
                        links.push(makeLink(`tasks/${item.task}`, `Task: ${item.task}`));
                    }
                });
            }
        });
    }
    
    return links;
});
```

### Example: Dataview Integration

This example integrates with Dataview to create dynamic links:

```typescript
const unregister = window.snwAPI!.registerVirtualLinkProvider(async ({ file, cache, makeLink }) => {
    const links: any[] = [];
    
    // Check if Dataview is available
    if (window.DataviewAPI) {
        try {
            // Query for related files based on tags
            const relatedFiles = await window.DataviewAPI.query(`
                LIST
                FROM #${cache?.frontmatter?.tags?.join(' OR #') || 'none'}
                WHERE file.name != "${file.basename}"
                LIMIT 5
            `);
            
            // Create links to related files
            if (relatedFiles.value) {
                relatedFiles.value.forEach((result: any) => {
                    links.push(makeLink(result.file.path, `Related: ${result.file.name}`));
                });
            }
        } catch (error) {
            console.warn('Dataview query failed:', error);
        }
    }
    
    return links;
});
```

## API Reference

### VirtualLinkProvider Function

The provider function receives an object with:

- `file: TFile` - The Obsidian file being processed
- `cache: CachedMetadata` - The file's metadata cache
- `makeLink: (linkText: string, displayText?: string, pos?: Pos) => Link` - Helper to create Link objects

### makeLink Helper

The `makeLink` helper creates properly formatted Link objects:

```typescript
// Basic usage
makeLink('Note Name')

// With display text
makeLink('Note Name', 'Custom Display Text')

// With position (optional)
makeLink('Note Name', 'Display Text', { start: { line: 1, col: 0, offset: 0 }, end: { line: 1, col: 10, offset: 10 } })
```

### Link Object Structure

```typescript
interface Link {
    reference: {
        link: string;
        key: string;
        displayText: string;
        position: Pos;
    };
    resolvedFile: TFile | null;
    realLink: string;
    sourceFile: TFile | null;
}
```

## Best Practices

1. **Error Handling**: Always wrap your provider logic in try-catch blocks
2. **Performance**: Keep providers lightweight and efficient
3. **Unregistering**: Always unregister providers when they're no longer needed
4. **Async Support**: Providers can be async functions
5. **Ghost Files**: The system handles non-existent files gracefully

## Integration with Other Plugins

Virtual Links work seamlessly with:
- Reference counting and display
- Gutter indicators
- Sidebar reference lists
- All existing SNW features

The links go through the same equivalence policy as regular wikilinks, ensuring consistent behavior across the plugin.
