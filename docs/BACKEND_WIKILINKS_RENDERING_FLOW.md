# Backend Wikilinks Rendering Flow

This document outlines the logical steps to render inferred wikilinks from the backend, with specific line number references to the codebase.

## 1\. Backend Integration Setup ✅

**Location**: `src/main.ts:426-458`

The plugin initializes the backend client and registers the vault with the backend service:

```typescript
// Line 430: Initialize BackendClient
this._backendClient = new BackendClient(this.settings.backend.baseUrl);

// Line 434-435: Get vault base path
const basePath = (this.app.vault.adapter as any).getBasePath?.() ?? "";

// Line 444-445: Register vault with backend
const vaultName = this.settings.backend.vaultName || this.app.vault.getName() || "default-vault";
await this._backendClient.register(vaultName, basePath);
```

**Backend Client Registration**: `src/backend/client.ts:11-35`

*   Line 18-22: HTTP POST to `/register` endpoint
*   Line 28-30: Store vault information for later use

## 2\. Backend Provider Registration ✅

**Location**: `src/main.ts:463-477`

The backend provider is registered as a virtual link provider:

```typescript
// Line 470-472: Register backend provider
this.unregisterBackendProvider = this.snwAPI.registerVirtualLinkProvider(
  createBackendLinksProvider(this.snwAPI, this._backendClient)
);
```

**Provider Registration**: `src/backend/provider.ts:11-13`

*   Line 13: Provider function that returns virtual links for a given file

## 3\. Keyword Fetching ✅

**Location**: `src/backend/provider.ts:30-32`

The backend provider fetches keyword candidates from the backend API:

```typescript
// Line 31: Fetch keywords for current file
const res = await client.getKeywordCandidatesForFile(file.path);
```

**API Call**: `src/backend/client.ts:146-153`

*   Line 152: Calls `getKeywordCandidates()` with vault and file path
*   Line 112: HTTP GET to `/candidates?vault={vault}&path={file}`
*   Line 136-138: Parse `CandidatesResponse` with keywords and spans

## 4\. Virtual Link Conversion ✅

**Location**: `src/backend/provider.ts:38-43`

Backend keywords are converted to virtual link format:

```typescript
// Line 39-43: Convert keywords to virtual links
const virtualLinks = res.keywords.map(kw => {
  const link = makeLink(`keyword:${kw.keyword}`, kw.keyword);
  return link;
});
```

## 5\. Implicit Links Processing ✅

**Location**: `src/implicit-links/manager.ts:25-113`

The implicit links manager processes all virtual link providers:

```typescript
// Line 33: Get virtual link providers
const providers = plugin.snwAPI?.virtualLinkProviders || [];

// Line 45-56: Process all providers
const batches = await Promise.all(
  providers.map(async (p: any) => {
    const result = await p({ file, cache, makeLink });
    return result || [];
  })
);

// Line 58: Flatten all virtual links
const links = batches.flat();
```

## 6\. Phrase Info Computation ✅

**Location**: `src/implicit-links/manager.ts:94-107`

Virtual links are converted to phrase information:

```typescript
// Line 95-107: Convert to phrase info map
for (const l of links) {
  const linktext = l.display && l.display.trim() ? l.display : l.realLink.replace(/\.md$/, "");
  const key = generateReferenceKey(plugin, linktext, file);
  const count = getReferenceCount(plugin, key);

  // Skip if count is below threshold
  if (count < (plugin?.settings?.minimumRefCountThreshold ?? 0)) continue;

  byPhrase.set(linktext.toLowerCase(), {
    target: l.realLink,
    count,
  });
}
```

## 7\. Cache Update ✅

**Location**: `src/implicit-links/manager.ts:141-149`

The inferred cache is updated with new phrase information:

```typescript
// Line 142-146: Build new cache
const newCache: InferredCache = {
  byPhrase,
  totalPhrases: byPhrase.size,
  phrasesVersion: Date.now(), // bump to force rebuild of regex chunks
};

// Line 149: Update field atomically
view.dispatch({ effects: setInferredCache.of(newCache) });
```

## 8\. Regex Chunk Building ✅

**Location**: `src/implicit-links/manager.ts:151-163`

Regex chunks are built for efficient phrase matching:

```typescript
// Line 152: Extract phrases from provider map
const phrases = phrasesFromProviderMap(byPhrase);

// Line 153-157: Build regex chunks
const regexes = buildPhraseRegexChunks(phrases, {
  boundaryMode: cfg.boundaryMode,
  caseInsensitive: cfg.caseInsensitive,
  maxPerChunk: cfg.maxPerChunk,
});

// Line 158: Create chunk plugins
const chunkExts = regexes.map((regex) => makeChunkPlugin(regex, plugin));

// Line 161-163: Reconfigure compartment
view.dispatch({
  effects: chunksCompartment.reconfigure(chunkExts),
});
```

## 9\. Decoration Creation ✅

**Location**: `src/implicit-links/decorators.ts:56-97`

CodeMirror decorations are created for matched phrases:

```typescript
// Line 57-58: Create MatchDecorator
const decorator = new MatchDecorator({
  regexp: regex,
  decorate(add, from, to, match, view) {
    // Line 62-67: Skip explicit links and code blocks
    if (isInsideWikiLink(doc, from, to)) return;
    if (isInsideMarkdownLink(doc, from, to)) return;
    if (isInsideCode(doc, from, to)) return;

    // Line 70-75: Lookup phrase and decorate
    const cache = view.state.field(inferredCacheField, false);
    const text = match[0];
    const info = cache.byPhrase.get(text.toLowerCase());
    if (!info || info.count <= 0) return;

    // Line 80: Add decorations
    addLinkDecos(add, from, to, text, info, key, plugin);
  }
});
```

## 10\. Visual Rendering ✅

**Location**: `src/implicit-links/decorators.ts:39-53`

Visual decorations are applied to matched text:

```typescript
// Line 40-51: Add mark decoration (underline)
add(
  from,
  to,
  Decoration.mark({
    class: "internal-link snw-implicit-link",
    attributes: {
      "data-snw-target": info.target,
      "data-snw-linktext": text,
      title: `${text} • ${info.count} reference${info.count === 1 ? "" : "s"}`,
    },
  })
);

// Line 52: Add count badge widget
add(to, to, Decoration.widget({ side: 1, widget: new CountBadge(info.count, key, plugin) }));
```

**Count Badge Widget**: `src/implicit-links/decorators.ts:10-36`

*   Line 22-24: Create badge element with count
*   Line 28-32: Bind hover functionality

## 11\. Interaction Handling ✅

**Location**: `src/implicit-links/manager.ts:193-208`

User interactions are handled for inferred links:

```typescript
// Line 194-201: Click handling for inferred links
mousedown(ev, view) {
  const el = (ev.target as HTMLElement)?.closest?.(".snw-implicit-link");
  if (!el) return;
  ev.preventDefault();
  const toPath = el.getAttribute("data-snw-target") || "";
  const from = plugin?.app?.workspace?.getActiveFile?.()?.path ?? "";
  const dest = plugin?.app?.metadataCache?.getFirstLinkpathDest?.(toPath, from);
  plugin?.app?.workspace?.openLinkText?.(dest?.path ?? toPath, from, false);
}

// Line 202-207: Badge click handling
click(ev, view) {
  const badge = (ev.target as HTMLElement)?.closest?.(".snw-implicit-badge");
  if (!badge) return;
  ev.preventDefault();
  // Open references panel
}
```

## Key Integration Points

### Backend Provider

*   **File**: `src/backend/provider.ts`
*   **Purpose**: Bridges backend API to virtual link system
*   **Key Lines**: 13 (provider function), 31 (API call), 39-43 (conversion)

### Implicit Links Manager

*   **File**: `src/implicit-links/manager.ts`
*   **Purpose**: Orchestrates the entire flow
*   **Key Lines**: 25-113 (phrase computation), 133-164 (refresh logic)

### Decorators

*   **File**: `src/implicit-links/decorators.ts`
*   **Purpose**: Handles visual rendering and interactions
*   **Key Lines**: 39-53 (decoration creation), 56-97 (chunk plugin)

### Main Plugin

*   **File**: `src/main.ts`
*   **Purpose**: Initializes backend integration and manages lifecycle
*   **Key Lines**: 426-458 (backend init), 463-477 (provider registration)

## Performance Optimizations

*   **Debouncing**: 120ms delay to avoid excessive API calls (`src/implicit-links/manager.ts:127`)
*   **Chunking**: Phrases split into chunks of max 300 for efficient regex matching (`src/implicit-links/manager.ts:127`)
*   **Caching**: Inferred cache prevents redundant processing (`src/implicit-links/cache.ts`)
*   **Active File Only**: Backend provider only processes currently active file (`src/backend/provider.ts:15-19`)

## Data Flow Summary

1.  **Backend API** → `CandidatesResponse` with keywords and spans
2.  **Virtual Links** → Converted to `makeLink()` format
3.  **Phrase Info** → Map of normalized phrases to targets and counts
4.  **Inferred Cache** → CodeMirror state field with phrase data
5.  **Regex Chunks** → Optimized patterns for text matching
6.  **Decorations** → Visual marks and widgets in editor
7.  **User Interactions** → Click navigation and hover previews