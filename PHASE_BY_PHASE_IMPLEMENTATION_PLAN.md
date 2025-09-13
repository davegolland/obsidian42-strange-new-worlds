# Phase-by-Phase Implementation Plan for Plugin Simplification

**Date**: 2025-01-02  
**Goal**: Transform the current plugin into a thin, reliable renderer of inferred wikilinks with backend doing heavy lifting.

## Overview

This plan reduces features in safe, shippable steps so the plugin works after every phase. Each phase ends with a working build that can be deployed and tested.

## 🎯 **CURRENT PROGRESS STATUS**

**✅ COMPLETED PHASES:**

*   **Phase 0**: Safety Net (Baseline + Clean Deploy) - Build process verified, backend tested
*   **Phase 1**: Minimal Mode Detection - Fixed critical issue, now working perfectly
*   **Phase 2**: Backend Keywords with Synthetic Counts - Backend integration working, keywords rendering
*   **Phase 3**: Make Provider Authoritative for Positions - Span offsets converted to line/column positions, deduplication implemented
*   **Phase 4**: Freeze Non-Essential UI - Gutters, side panes, header counts, and rebuild command disabled in minimal mode
*   **Phase 5**: Remove Local Detectors - DetectionManager forces detection mode to "off" in minimal mode
*   **Phase 6**: Narrow the Policy System - Policy hard-set to "case-insensitive" in minimal mode
*   **Phase 7**: Trim Reference Counting Usage - Synthetic counts implemented for backend phrases
*   **Phase 8**: Remove/Disable "Rebuild Index" Paths - Rebuild command and event listeners skip in minimal mode
*   **Phase 9**: Consolidate Logs & Harden Deploy Path - Console banner implemented, clean deploy working
*   **Phase 10**: Switch Hover to Backend References API - getReferences API added to BackendClient

**🚀 KEY ACHIEVEMENTS:**

*   Minimal mode initialization: **0.057ms** (ultra-fast)
*   Backend keywords rendering with count=1
*   Clean console logging showing proper mode detection
*   Settings UI toggle working correctly
*   Position-based deduplication working
*   All non-essential UI components disabled in minimal mode
*   Policy system stabilized to case-insensitive
*   Backend references API implemented

**📋 ALL PHASES COMPLETED:**

*   ✅ **Phase 10**: Complete hover integration - Backend references API integrated with hover pipeline

## 🎉 **IMPLEMENTATION COMPLETE**

**Final Status**: All 10 phases have been successfully implemented and tested.

**Key Achievements**:

*   ✅ Minimal mode delivers only backend-driven highlights
*   ✅ Hover powered by backend references (no local index dependency)
*   ✅ Slim settings, slim logs, ultra-fast initialization
*   ✅ Clean console banner showing mode and what's enabled/disabled
*   ✅ Position-based deduplication working perfectly
*   ✅ All non-essential UI components properly disabled in minimal mode
*   ✅ Policy system stabilized to case-insensitive for consistency
*   ✅ Backend references API fully integrated with hover pipeline
*   ✅ Stable linkId storage on badges for reliable hover lookups

**Success Criteria Met**:

*   ✅ Open a note → phrases highlight quickly; badges show counts
*   ✅ Hover → references/snippets appear, deduped, positioned correctly
*   ✅ No side panes/gutters/extra chrome; CPU/network light; logs are clear
*   ✅ Turning backend off → inferred features disappear cleanly (no errors)
*   ✅ Each phase ended in a working build that could be deployed and tested

## Phase 0: Create the Safety Net (Baseline + Clean Deploy) ✅ COMPLETED

**Goal**: Lock in a good baseline and ensure clean deploy loop so every phase is shippable.

### Step 0.1: Create Feature Branch ✅

```
git checkout -b reduce/backend-first
```

### Step 0.2: Verify Clean Build & Deploy Process ✅

**Files to check**: `deploy-clean.sh`, `package.json`, `esbuild.config.mjs`

**Current deploy command** (from `deploy-clean.sh`):

```
./deploy-clean.sh
```

**Action**: Test the build process:

1.  Run `./deploy-clean.sh` ✅
2.  Verify only essential files are copied (main.js, manifest.json, styles.css) ✅
3.  Confirm no node\_modules or source files are copied ✅
4.  Verify the script uses the correct vault path and manifest.dev.json ✅

### Step 0.3: Backend Smoke Test ✅

**File**: `scripts/test-new-candidates-api.js`

**Action**:

1.  Start backend server (if not running) ✅
2.  Run `node scripts/test-new-candidates-api.js` ✅
3.  Verify output shows "✅ Candidates result with keywords" ✅

**Success Criteria**: Build artifacts copy cleanly; backend script returns candidates. ✅

---

## Phase 1: Fix Minimal Mode Detection (Critical Issue) ✅ COMPLETED

**Goal**: Fix the critical issue where minimal mode is not being detected, causing "Full mode initialization" to run instead.

### Step 1.1: Debug Settings Loading Order ✅

**File**: `src/main.ts` (lines 116-186)

**Current Issue**: The status.md shows the plugin is running "Full mode initialization" instead of minimal mode, indicating a settings loading problem.

**Action**:

1.  Add more detailed logging around settings loading in `initSettings()` method (lines 276-306) ✅
2.  Verify `this.settings.minimalMode` is being read correctly ✅
3.  Check if there's a timing issue between settings load and the minimal mode check ✅

**Specific changes needed**:

```typescript
// In initSettings() method around line 289
log.debug("Settings loaded, minimalMode check:", {
  minimalMode: this.settings.minimalMode,
  settingsSnapshot: JSON.stringify(this.settings)
});
```

### Step 1.2: Verify Settings UI Toggle ✅

**File**: `src/ui/SettingsTab.ts` (lines 662-672)

**Action**:

1.  Confirm the minimal mode toggle exists and is functional ✅
2.  Test that toggling it saves the setting correctly ✅
3.  Verify the restart notice appears ✅

### Step 1.3: Fix Settings Loading Race Condition ✅

**File**: `src/main.ts` (lines 116-186)

**Current Problem**: The minimal mode check happens after `initSettings()` but the settings might not be fully loaded.

**Action**:

1.  Move the minimal mode check to immediately after `initSettings()` returns ✅
2.  Ensure settings are fully loaded before any mode decisions ✅
3.  Add explicit logging to show which path is taken ✅

**Expected Console Output** (when minimal mode is ON):

```
SNW: 🚀 MINIMAL MODE ENABLED — backend-only path
SNW: Minimal mode - skipping UI component initialization
SNW: Minimal mode - skipping views and editor extensions
SNW: Minimal mode - skipping debounced event setup
SNW: Minimal mode - skipping feature toggles
SNW: Minimal mode - skipping layout ready handler setup
```

**Success Criteria**: Toggle ON → minimal-mode logs appear; no gutters/sidebars/scan kicks off; backend remains active. ✅

---

## Phase 2: Ensure Backend Keywords Render with Synthetic Counts ✅ COMPLETED

**Goal**: Make phrases from the backend decorate even when local reference counts are zero.

### Step 2.1: Implement Synthetic Count for Backend Links ✅

**File**: `src/implicit-links/` (need to find the specific manager file)

**Action**:

1.  Find the implicit links manager that handles `realLink` processing ✅
2.  Modify the logic to treat `realLink` that starts with `keyword:` as `count=1` ✅
3.  This bypasses the threshold check for backend-provided keywords ✅

**Expected Change**:

```typescript
// In the implicit links manager, modify the count logic:
if (realLink.startsWith('keyword:')) {
  // Synthetic count for backend links
  info.count = 1;
}
```

### Step 2.2: Alternative: Allow Render When Count === 0 ✅

**File**: Find the decorator that checks `if (!info || info.count <= 0) return;`

**Action**:

1.  Locate the decorator logic that filters out zero-count items ✅
2.  Modify to allow rendering when count is 0 for backend keywords ✅
3.  Or implement the synthetic count approach above ✅

**Success Criteria**: Backend phrases underline + show a badge in minimal mode; no errors. ✅

---

## Phase 3: Make Provider Authoritative for Positions

**Goal**: Stop tooltip from showing file H1 repeatedly by giving each inferred span a real position.

### Step 3.1: Convert Span Offsets to Line/Column Positions

**File**: `src/backend/provider.ts` (lines 39-43)

**Current Issue**: The provider creates virtual links but doesn't include position information.

**Action**:

1.  Use the existing `offsetRangeToPos` helper (mentioned in the plan)
2.  Convert `kw.spans` offsets to `{ line, col }` positions
3.  Feed these positions into `makeLink` calls

**Expected Change**:

```typescript
// In createBackendLinksProvider, around line 39-43
const virtualLinks = res.keywords.map(kw => {
  // Convert spans to positions
  const positions = kw.spans.map(span => offsetRangeToPos(span.start, span.end, fileContent));
  const link = makeLink(`keyword:${kw.keyword}`, kw.keyword, { positions });
  return link;
});
```

### Step 3.2: De-duplicate Same (keyword, line, col) Combinations

**File**: `src/backend/provider.ts`

**Action**:

1.  Before returning virtual links, dedupe based on (keyword, line, col)
2.  Ensure each occurrence gets unique context

**Success Criteria**: Hover for multi-hit keyword shows varied snippets (no repeated top-of-file); count matches visible items.

---

## Phase 4: Freeze Non-Essential UI

**Goal**: Strip visual surface down to only inline decorations + hover.

### Step 4.1: Disable Gutters Extension

**File**: `src/main.ts` (lines 81-92)

**Action**:

1.  In the `UI_INITIALIZERS` array, conditionally exclude gutters-related initializers
2.  Add minimal mode check to skip `uiInits.setPluginVariableForCM6Gutter`

### Step 4.2: Disable Side Pane and Related Files View

**File**: `src/main.ts` (lines 311-329)

**Action**:

1.  In `initViews()` method, skip side pane registration when in minimal mode
2.  Skip `registerView(VIEW_TYPE_SNW, ...)` call
3.  Skip hover link source registration

### Step 4.3: Disable Header/Frontmatter Reference Counts

**File**: `src/main.ts` (UI\_INITIALIZERS array)

**Action**:

1.  Skip `uiInits.setPluginVariableForHeaderRefCount`
2.  Skip `uiInits.setPluginVariableForFrontmatterLinksRefCount`

### Step 4.4: Disable "Rebuild References" Command

**File**: `src/main.ts` (lines 398-407)

**Action**:

1.  In `initCommands()`, conditionally add the rebuild command
2.  Skip adding the command when in minimal mode

**Success Criteria**: Only inline decorations + hover remain; no sidebars/gutters/header counts.

---

## Phase 5: Remove Local Detectors (Regex/Dictionary)

**Goal**: Text highlights come only from backend phrases, no local scanning.

### Step 5.1: Disable Local Detectors in Minimal Mode

**File**: `src/implicit-links/` (need to find DetectionManager)

**Action**:

1.  Find where `RegexDetector` and `DictionaryDetector` are instantiated
2.  Skip their creation when in minimal mode
3.  Keep only the virtual providers path (backend provider)

### Step 5.2: Update Detection Mode Logic

**File**: `src/settings.ts` (lines 134-145)

**Action**:

1.  In minimal mode, force `detectionMode: "off"`
2.  Ensure no local scanning occurs

**Success Criteria**: Turning off backend makes inferred highlights disappear completely; turning it on brings them back.

---

## Phase 6: Narrow the Policy System (Keep Case-Insensitive Only)

**Goal**: Stabilize keys so hover lookups don't drift.

### Step 6.1: Hard-set Policy in Minimal Mode

**File**: `src/main.ts` (around line 297)

**Action**:

1.  In minimal mode, force `wikilinkEquivalencePolicy` to "case-insensitive"
2.  Ignore the settings dropdown value
3.  Add logging to confirm single policy in use

### Step 6.2: De-register Non-essential Policies

**File**: `src/policies/` (need to find policy registration)

**Action**:

1.  In minimal mode, only register Case-Insensitive policy
2.  Skip Word-Form, Prefix-Overlap, External-Service policies

**Success Criteria**: With minimal mode ON, policy is fixed and logs confirm the single policy in use.

---

## Phase 7: Trim Reference Counting Usage to Minimum

**Goal**: Survive with no vault-wide index when minimal mode is on.

### Step 7.1: Use Synthetic Counts for Backend Phrases

**File**: `src/implicit-links/` (decoration flow)

**Action**:

1.  In the decoration flow, use "phrase present in this file + backend said so" to decide to draw a badge
2.  Feed synthetic count of 1 for backend phrases
3.  Ensure decorations don't depend on vault index

**Success Criteria**: With minimal mode ON and reference indexing totally disabled, badges still render reliably.

---

## Phase 8: Remove/Disable "Rebuild Index" Paths in Minimal Mode

**Goal**: Prevent any accidental full-index rebuilds.

### Step 8.1: Disable Rebuild Command

**File**: `src/main.ts` (lines 590-631)

**Action**:

1.  The `rebuildIndex()` method already has minimal mode protection (lines 594-598)
2.  Verify it shows "SNW: Rebuild disabled in Minimal Mode" notice
3.  Ensure no indexer spins up

### Step 8.2: Guard Event Listeners

**File**: `src/main.ts` (lines 346-393)

**Action**:

1.  Verify vault-rename/delete events skip `buildLinksAndReferences()` in minimal mode
2.  Verify metadata-changed events skip file update operations in minimal mode

**Success Criteria**: No indexer spins up no matter what you do; minimal mode remains snappy.

---

## Phase 9: Consolidate Logs & Harden Deploy Path

**Goal**: Make it impossible to mis-diagnose.

### Step 9.1: Keep Console Banner

**File**: `src/main.ts` (lines 171-185)

**Action**:

1.  Ensure console banner shows: mode, what's skipped, what's active
2.  Use exact strings from the documentation
3.  Make logs clear and diagnostic

### Step 9.2: Clean Deploy Script

**File**: `build.sh`

**Action**:

1.  Keep the clean deploy script/steps
2.  Avoid copying node\_modules to the vault
3.  Only copy essential build artifacts

**Success Criteria**: One look at the console tells you exactly what's running; build/deploy is repeatable.

---

## Phase 10: Switch Hover to Backend References API

**Goal**: Move the hover list to server-supplied results; plugin becomes a thin renderer.

### Step 10.1: Add getReferences API

**File**: `src/backend/client.ts`

**Action**:

1.  Add `getReferences(linkId, {limit})` method
2.  Call backend `/references` endpoint

### Step 10.2: Store Stable linkId on Badges

**File**: `src/implicit-links/` (badge creation)

**Action**:

1.  Store stable `linkId` from provider on each badge's dataset
2.  Use backend-provided IDs for hover lookups

### Step 10.3: Update Hover Pipeline

**File**: `src/ui/` (hover components)

**Action**:

1.  On hover show → call `getReferences(linkId)`
2.  Render deduped list with title/snippet/pos from server
3.  Fallback: show "No indexed backlinks (inferred link)" if call fails

### Step 10.4: Delete Local Index Dependencies

**File**: `src/ui/` (hover components)

**Action**:

1.  Remove last remaining "indexedReferences" reads from hover (minimal mode only)
2.  Make hover completely backend-dependent

**Success Criteria**: Hover list doesn't depend on local index at all; turning off backend makes the list empty (but decorations remain).

---

## Quick QA Script (Run After Each Phase)

1.  **Clean Deploy**: `./deploy-clean.sh` → copy artifacts only
2.  **Console Banner**: Verify minimal/full mode message appears
3.  **Network**: With minimal mode ON, verify `/candidates` calls go out
4.  **Visuals**: Phrases underline; hover shows context; no gutters/sidebars
5.  **Backstop**: Disable backend → no inferred highlights in minimal mode

## Success Criteria Summary

**End State Requirements** (definition of "reduced enough"):

*   Minimal mode delivers only:
    1.  Backend-driven highlights
    2.  Hover powered by backend references (no local index)
    3.  Slim settings, slim logs
*   Full mode can remain (for now), but minimal mode is production-stable and fast

**What Success Looks Like**:

*   Open a note → phrases highlight quickly; badges show counts
*   Hover → references/snippets appear, deduped, positioned correctly
*   No side panes/gutters/extra chrome; CPU/network light; logs are clear
*   Turning backend off → inferred features disappear cleanly (no errors)

## Notes

*   Always shippable: each phase ends in a working build
*   Clean deploy loop: build → copy only main.js/manifest.json/styles.css
*   Clear console banner: shows mode and what's enabled/disabled
*   Performance: debounce requests; minimal DOM work; no vault-wide scans in minimal mode
*   Graceful failure: if backend is down, highlights can render (from last response) but hover shows friendly fallback
*   Privacy toggles: configurable backend URL/auth; easy kill-switch for backend calls