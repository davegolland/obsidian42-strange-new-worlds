# Detailed Implementation Plan: Backend-Driven Wikilinks Rendering

This document provides specific line numbers and exact code changes needed to implement backend-driven wikilinks rendering.

## A) Clean Deploy & Settings (Prerequisites)

### 1\. Clean Build and Deploy

```
npm run build
# Copy ONLY the built files (not node_modules or source)
cp build/main.js build/manifest.json build/styles.css "<your-vault>/.obsidian/plugins/obsidian42-strange-new-worlds-dev/"
```

### 2\. Enable Backend Integration

*   Open SNW settings → enable "Backend Integration"
*   Set the backend base URL
*   The plugin's `refreshBackendProvider()` will initialize the client and register the virtual link provider

### 3\. Start Backend and Test

```
# Use existing test script
node scripts/test-new-candidates-api.js
# Should see: ✅ Candidates result with keywords
```

## B) Code Changes (Exact Line Numbers)

### 1\. Remove Minimal Mode Early Return in Provider

**File:** `src/backend/provider.ts`  
**Lines to modify:** 22-25

**Current code:**

```typescript
// Skip if we're in minimal mode (backend-only mode)
if (api.plugin?.settings?.minimalMode) {
  log.debug("Backend provider: skipping in minimal mode");
  return [];
}
```

**Change to:**

```typescript
// REMOVED: Skip if we're in minimal mode (backend-only mode)
// if (api.plugin?.settings?.minimalMode) {
//   log.debug("Backend provider: skipping in minimal mode");
//   return [];
// }
```

**Why:** This early return prevents any backend links from being produced when minimal mode is enabled, blocking all rendering.

### 2\. Ensure Client Makes Real HTTP Calls

**File:** `src/backend/client.ts`  
**Status:** ✅ ALREADY IMPLEMENTED

The `getKeywordCandidatesForFile()` method on lines 146-153 is already properly implemented and calls the real `/candidates` endpoint. No changes needed here.

**Verification:** Lines 111-143 show the `getKeywordCandidates()` method that makes the actual HTTP GET request with proper 503 handling.

### 3\. Allow Backend Phrases to Bypass Reference Count Threshold

**File:** `src/implicit-links/manager.ts`  
**Lines to modify:** 95-107

**Current code:**

```typescript
// Convert to phrase info map
for (const l of links) {
  const linktext = l.display && l.display.trim() ? l.display : l.realLink.replace(/\.md$/, "");
  const key = generateReferenceKey(plugin, linktext, file);
  const count = getReferenceCount(plugin, key);

  // Skip if count is below threshold (same as native SNW behavior)
  if (count < (plugin?.settings?.minimumRefCountThreshold ?? 0)) continue;

  byPhrase.set(linktext.toLowerCase(), {
    target: l.realLink,
    count,
  });
}
```

**Change to:**

```typescript
// Convert to phrase info map
for (const l of links) {
  const linktext = l.display && l.display.trim() ? l.display : l.realLink.replace(/\.md$/, "");
  const key = generateReferenceKey(plugin, linktext, file);
  const count = getReferenceCount(plugin, key);

  // Check if this is a backend keyword (starts with "keyword:")
  const isBackendKeyword = l.realLink?.startsWith("keyword:");
  
  // For backend keywords, use synthetic count of 1 to bypass threshold
  // For native phrases, apply the threshold filter
  const effectiveCount = isBackendKeyword ? 1 : count;
  
  if (!isBackendKeyword && effectiveCount < (plugin?.settings?.minimumRefCountThreshold ?? 0)) {
    continue;
  }

  byPhrase.set(linktext.toLowerCase(), {
    target: l.realLink,
    count: effectiveCount,
  });
}
```

**Why:** Backend keywords won't have native reference counts in SNW's local index, so they get filtered out by the threshold check. This change gives them a synthetic count of 1.

### 4\. Allow Rendering When Count is 0 (Alternative Approach)

**File:** `src/implicit-links/decorators.ts`  
**Lines to modify:** 74-75

**Current code:**

```typescript
const info = cache.byPhrase.get(text.toLowerCase());
if (!info || info.count <= 0) return;
```

**Change to:**

```typescript
const info = cache.byPhrase.get(text.toLowerCase());
if (!info) return;
// REMOVED: info.count <= 0 check to allow rendering even with 0 count
```

**Why:** This allows phrases to render even when they have 0 references, which is useful for backend-only keywords.

**Note:** Choose either approach #3 OR #4, not both. Approach #3 (synthetic count) is recommended as it provides better UX with meaningful count badges.

## C) Verification Steps

### 1\. Provider Logs

Open DevTools console in Obsidian while viewing a note. Look for:

```
Backend provider called for active file: [filepath]
Backend provider response: [N] keywords
Backend provider: converted to virtual links [N]
```

### 2\. Network Calls

In DevTools Network tab, verify HTTP GET requests to:

```
/candidates?vault=[vault]&path=[filepath]
```

### 3\. Manager Processing

Look for console logs:

```
[ImplicitLinks manager] computePhraseInfo: found providers [N]
[ImplicitLinks manager] provider returned [N] links
[ImplicitLinks manager] total links from all providers: [N]
```

### 4\. Visual Rendering

*   Matched phrases should appear with underline decoration
*   Count badges should appear next to phrases
*   Hover should show tooltip with reference count

### 5\. Settings Panel Check

The "Wikilink Candidates" view should NOT show: "Backend disabled or client not initialized."

## D) Implementation Checklist

*   Clean build deployed (no node\_modules in plugin dir)
*   Backend enabled in settings; provider registered
*   `src/backend/provider.ts` lines 22-25: minimal-mode early-return removed
*   `src/backend/client.ts`: ✅ Already properly implemented
*   `src/implicit-links/manager.ts` lines 95-107: backend phrases bypass threshold OR get count = 1
*   `src/implicit-links/decorators.ts` lines 74-75: allow render when info exists (optional alternative)
*   DevTools shows provider logs and network calls
*   Decorations visible on text in editor

## E) Troubleshooting

### If nothing renders:

1.  Confirm `refreshBackendProvider()` ran after enabling backend
2.  Use `/candidates` test script to verify backend returns keywords for exact vault/path
3.  Check "Wikilink Candidates" settings panel for error messages
4.  Verify minimal mode is OFF (or decorators are enabled in minimal mode)

### If backend keywords don't appear:

1.  Check that the threshold bypass is working (approach #3)
2.  Verify the decorator count check is relaxed (approach #4)
3.  Confirm virtual links are being created with `keyword:` prefix

### If network calls fail:

1.  Verify backend is running and accessible
2.  Check vault registration in client
3.  Confirm URL encoding in `/candidates` endpoint

## F) File Summary

**Files to modify:**

*   `src/backend/provider.ts` (lines 22-25) - Remove minimal mode early return
*   `src/implicit-links/manager.ts` (lines 95-107) - Add backend keyword threshold bypass
*   `src/implicit-links/decorators.ts` (lines 74-75) - Optional: relax count check

**Files already correct:**

*   `src/backend/client.ts` - HTTP calls already implemented
*   `src/backend/types.ts` - Types already defined
*   `src/main.ts` - Provider registration already implemented

This implementation will take you from "backend wired but invisible" to "backend keywords actually underlined in the editor" with minimal, surgical changes.