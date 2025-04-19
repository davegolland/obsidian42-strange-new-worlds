# Wikilink Equivalence Classes Implementation Plan

## Overview

This document outlines the plan to extend the Strange New Worlds plugin with configurable "equivalence classes" for wikilinks. This feature will allow users to customize how references are grouped and counted based on different equivalence policies.

## 1. Core Concept

The plugin will support different ways of determining when wikilinks should be considered equivalent, with a single active policy determining the grouping behavior.

### Use Cases

- Group different capitalizations of the same link
- Unify various word forms (e.g., mess, messy, messiness)
- Consider links within the same file as equivalent
- Ignore file paths and focus only on base filenames

## 2. Architecture

### 2.1 Policy Interface

```typescript
interface WikilinkEquivalencePolicy {
  name: string;
  generateKey(link: Link): string;
}
```

Each policy defines how links should be normalized and grouped by implementing a `generateKey` method that transforms links into comparable keys.

### 2.2 Initial Policy Implementations

- **Case Insensitive Policy (Default)**
  ```typescript
  class CaseInsensitivePolicy implements WikilinkEquivalencePolicy {
    name = "Case Insensitive";
    
    generateKey(link: Link): string {
      if (link.resolvedFile) {
        return link.resolvedFile.path.toUpperCase();
      }
      return link.realLink.toUpperCase();
    }
  }
  ```

- **Same File Policy**
  ```typescript
  class SameFilePolicy implements WikilinkEquivalencePolicy {
    name = "Same File Unification";
    
    generateKey(link: Link): string {
      const baseKey = link.resolvedFile ? 
        link.resolvedFile.path.toUpperCase() : 
        link.realLink.toUpperCase();
        
      return `${link.sourceFile?.path.toUpperCase()}:${baseKey}`;
    }
  }
  ```

- **Word Form Policy**
  ```typescript
  class WordFormPolicy implements WikilinkEquivalencePolicy {
    name = "Word Form Unification";
    
    generateKey(link: Link): string {
      const baseName = link.realLink.split('/').pop() || link.realLink;
      // Simple lemmatization example
      return baseName
        .toLowerCase()
        .replace(/(\w+)(s|es|ing|ed|ness|ity)$/, '$1');
    }
  }
  ```

- **Base Name Policy**
  ```typescript
  class BaseNamePolicy implements WikilinkEquivalencePolicy {
    name = "Base Name Only";
     
    generateKey(link: Link): string {
      // Extract just the filename without path or extension
      const path = link.resolvedFile?.path || link.reference.link;
      const fileName = path.split('/').pop() || path;
      return fileName.replace(/\.\w+$/, '').toUpperCase();
    }
  }
  ```

### 2.3 Single Active Policy Architecture

```typescript
class ReferenceCountingPolicy {
  // Original index structure
  private indexedReferences: Map<string, Link[]>;
  
  // Current active policy
  private activePolicy: WikilinkEquivalencePolicy;
  
  // Set active policy
  setActivePolicy(policy: WikilinkEquivalencePolicy): void {
    this.activePolicy = policy;
    this.invalidateCache();
    // Trigger rebuild with new policy
    this.buildLinksAndReferences();
  }
  
  // Generate key using active policy
  private generateKey(link: Link): string {
    return this.activePolicy.generateKey(link);
  }
}
```

## 3. Implementation Strategy

### Phase 1: Core Architecture (MVP)

1. Add the `WikilinkEquivalencePolicy` interface and basic implementations
2. Modify `ReferenceCountingPolicy` to use the active policy when generating keys
3. Add settings to select the active policy
4. Update the reference building process to use the active policy

### Phase 2: Performance Enhancements

1. Optimize key generation for large vaults
   - Implement lazy rebuilding: only rebuild the index when needed
   - Add caching for commonly accessed references
2. Implement incremental updates when files change
3. Add performance monitoring

### Phase 3: Advanced Features

1. Add UI elements to switch between policies without going to settings
2. Provide visual indicators of the active policy
3. Save policy preferences per vault/workspace
4. Expand available policies based on user feedback

## 4. User Experience

### Settings

- **Policy Selection**: Dropdown to select the active equivalence policy
- **Policy Configuration**: Optional settings for specific policies (e.g., custom word form rules)

### UI Indicators

- Clear indication of which policy is currently active
- Visual representation of how links are grouped under the current policy

### Commands

- Command to cycle through available policies
- Command to toggle specific policies on/off

## 5. Performance Considerations

### Optimizations

1. **Lazy Rebuilding**: Only rebuild the index when needed (viewing references)
2. **Cached Results**: Cache reference counts for frequently accessed links
3. **Incremental Updates**: Only update affected parts of the index when files change
4. **Debounced Processing**: Group rapid changes to minimize processing
5. **Prioritized Processing**: Process visible/open files first

### Large Vault Handling

- Adapt processing based on vault size
- Consider background processing for very large vaults
- Add optional persistent storage for large indices

## 6. Risk Management

1. **Data Integrity**: Ensure index stays accurate during updates
2. **Performance**: Monitor and optimize for large vaults
3. **Backward Compatibility**: Maintain existing API behavior
4. **Edge Cases**: Handle complex links, aliases, and special characters

## 7. Future Enhancements

- Custom policy creation via simple configuration
- Natural language processing integration for advanced word form handling
- User-defined equivalence rules
- Visual graph of equivalent links

## 8. Implementation Timeline

1. **Week 1-2**: Core architecture and default policies
2. **Week 3-4**: Performance optimizations and testing
3. **Week 5-6**: UI enhancements and additional policies
4. **Week 7-8**: Testing and documentation 