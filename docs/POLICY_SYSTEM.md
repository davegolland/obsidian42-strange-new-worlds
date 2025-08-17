# Policy System Documentation

Strange New Worlds uses a modular policy system to determine how wikilinks should be considered equivalent. This document explains the new modular structure and how to work with it.

## Overview

The policy system has been modularized for better maintainability and extensibility. Each policy is now in its own file, making it easy to add, remove, or modify policies without affecting others.

## Directory Structure

```
src/policies/
├── base/
│   └── WikilinkEquivalencePolicy.ts    # Shared interface & abstract base
├── policies/
│   ├── CaseInsensitivePolicy.ts        # Case-insensitive matching
│   ├── CaseSensitivePolicy.ts          # Exact case matching
│   ├── BaseNamePolicy.ts               # Filename-only matching
│   ├── WordFormPolicy.ts               # Word form unification
│   ├── SameFilePolicy.ts               # Same-file context
│   ├── PrefixOverlapPolicy.ts          # Prefix-based grouping
│   ├── UniqueFilesPolicy.ts            # No grouping
│   └── ExternalServicePolicy.ts        # External service integration
├── auto-registry.ts                    # Auto-generated registry (DO NOT EDIT)
├── auto-types.ts                       # Auto-generated types (DO NOT EDIT)
├── registry.ts                         # Registry implementation
├── index.ts                            # Policy exports
├── linkKeyUtils.ts                     # Shared utilities
└── reference-counting.ts               # Main counting logic
```

## Policy Interface

All policies implement the `WikilinkEquivalencePolicy` interface:

```typescript
interface WikilinkEquivalencePolicy {
  /** Display name of the policy (for UI). */
  name: string;
  /** True if generateKeyAsync() will be used. */
  isAsync?(): boolean;
  /** Synchronous key generation (default). */
  generateKey?(link: Link): string;
  /** Async key generation (optional). */
  generateKeyAsync?(link: Link): Promise<string>;
  /** Count references (override to customize). */
  countReferences?(references: Link[] | undefined): number;
  /** Filter references (override to customize). */
  filterReferences?(references: Link[] | undefined): Link[];
}
```

## Available Policies

### Built-in Policies

1. **Case Insensitive** (`case-insensitive`)
   - Normalizes all links to uppercase
   - Groups: `[[Note]]`, `[[note]]`, `[[NOTE]]` → same key

2. **Case Sensitive** (`case-sensitive`)
   - Preserves original casing
   - Groups: `[[Note]]` and `[[note]]` are different

3. **Base Name Only** (`base-name`)
   - Uses only the filename without path or extension
   - Groups: `[[folder/note]]` and `[[note]]` → same key

4. **Word Form Unification** (`word-form`)
   - Applies light stemming to group word forms
   - Groups: `[[running]]`, `[[run]]`, `[[runs]]` → same key

5. **Same File Unification** (`same-file`)
   - Includes source file context
   - Groups: Links from same source file are treated uniquely

6. **Prefix Overlap** (`prefix-overlap`)
   - Groups files sharing a prefix before punctuation
   - Groups: `[[Project - Alpha]]`, `[[Project - Beta]]` → same key

7. **Unique Files** (`unique-files`)
   - No grouping beyond exact path matching
   - Each unique file path is counted separately

### External Service Policy

The **External Service Policy** (`external-service`) allows integration with external services for advanced link normalization:

```typescript
// Example configuration
new ExternalServicePolicy({ 
  endpoint: "http://localhost:8787/snw/key", 
  apiKey: "your-api-key" 
})
```

This policy:
- Sends link data to your backend service
- Receives canonical keys in response
- Falls back to local key generation if service is unavailable
- Supports async operations for better performance

## Configuration

### Auto-Discovery System

The policy system now uses **automatic discovery** - no manual configuration required! Simply add a new policy file to `src/policies/policies/` and it will be automatically registered.

**Policy ID Convention**: The system automatically generates policy IDs from filenames:
- `CaseInsensitivePolicy.ts` → `case-insensitive`
- `WordFormPolicy.ts` → `word-form`
- `ExternalServicePolicy.ts` → `external-service`

**Dynamic Settings Types**: The `WikilinkEquivalencePolicyType` is automatically generated from discovered policies, so TypeScript settings remain type-safe without manual updates.

### Enabling/Disabling Policies

Policies are automatically discovered from files in `src/policies/policies/`. To disable a policy:

1. **Temporary**: Comment out the registration in the generated `src/policies/auto-registry.ts`
2. **Permanent**: Rename the file (e.g., `ExternalServicePolicy.ts.bak`) or move it out of the directory

### Adding New Policies

1. Create a new file in `src/policies/policies/`:

```typescript
// src/policies/policies/CustomPolicy.ts
import { AbstractWikilinkEquivalencePolicy } from "../base/WikilinkEquivalencePolicy";
import type { Link } from "../../types";

export class CustomPolicy extends AbstractWikilinkEquivalencePolicy {
  name = "Custom Policy";
  
  generateKey(link: Link): string {
    // Your custom logic here
    return link.reference.link.toUpperCase();
  }
}
```

2. **That's it!** The policy will be automatically discovered and registered with ID `custom`.

### Policies with Constructor Parameters

For policies that need configuration (like `ExternalServicePolicy`), the auto-registry will comment them out with a TODO:

```typescript
// _registerPolicy("external-service", new ExternalServicePolicy({ endpoint: "http://localhost:8787/snw/key", apiKey: "env:SNW_KEY" })); // TODO: Configure external service policy
```

To enable such policies, uncomment and configure the registration in `src/policies/auto-registry.ts`.

### Async Policies

For policies that need external API calls or async operations:

```typescript
export class AsyncPolicy implements WikilinkEquivalencePolicy {
  name = "Async Policy";
  
  isAsync(): boolean { return true; }
  
  async generateKeyAsync(link: Link): Promise<string> {
    // Async logic here
    const response = await fetch('/api/normalize', {
      method: 'POST',
      body: JSON.stringify(link)
    });
    const { key } = await response.json();
    return key;
  }
  
  // Fallback for sync contexts
  generateKey(link: Link): string {
    return link.reference.link.toUpperCase();
  }
}
```

## Usage in Code

### Getting a Policy

```typescript
import { getPolicyByType } from './policies';

const policy = getPolicyByType('case-insensitive');
const key = policy.generateKey(link);
```

### Working with Async Policies

```typescript
const policy = getPolicyByType('external-service');

if (policy.isAsync()) {
  const key = await policy.generateKeyAsync(link);
} else {
  const key = policy.generateKey(link);
}
```

### Getting All Available Policies

```typescript
import { getPolicyOptions } from './policies';

const options = getPolicyOptions();
// Returns: [{ value: 'case-insensitive', name: 'Case Insensitive' }, ...]
```

## Best Practices

1. **Keep Policies Simple**: Each policy should have a single, clear responsibility
2. **Use Abstract Base**: Extend `AbstractWikilinkEquivalencePolicy` for common functionality
3. **Handle Errors Gracefully**: Async policies should have fallback mechanisms
4. **Test Individually**: Each policy can be tested in isolation
5. **Document Changes**: Update this file when adding new policies

## Migration from Old System

The old monolithic `wikilink-equivalence.ts` file has been replaced with the modular structure. All existing functionality is preserved, but the code is now more maintainable and extensible.

If you have custom policies from the old system, migrate them by:
1. Moving the class to `src/policies/policies/`
2. Extending `AbstractWikilinkEquivalencePolicy`
3. **That's it!** The auto-discovery system will automatically register your policy

The new system eliminates the need to manually maintain the policy registry - just add files and they're automatically discovered!
