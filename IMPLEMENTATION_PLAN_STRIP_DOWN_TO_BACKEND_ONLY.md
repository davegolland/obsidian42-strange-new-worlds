# Implementation Plan: Strip Down SNW Plugin to Backend Integration Only

**Date**: 2025-01-02
**Task**: Fix freezing issues by isolating backend integration
**Status**: Draft

## Overview
Strip down the Strange New Worlds (SNW) Obsidian plugin to only the "Backend inferred links" feature to isolate and identify freezing issues. This involves disabling all heavy features like implicit links detection, visual indicators, inline counters, gutters, and other UI components while keeping only the backend integration active.

## Current State Analysis
The SNW plugin currently has multiple heavy features that could cause freezing:

**Heavy Features Currently Active:**
- **Implicit Links Detection** (`implicit-links/` directory) - scans all files for phrase detection
- **Reference Counting Policy** (`policies/reference-counting.ts`) - builds comprehensive link indexes
- **Visual Indicators** - inline counters, gutters, markdown preview processors
- **UI Components** - sidebar views, header/property updates, debounced event handlers
- **Feature Manager** - manages multiple editor extensions and markdown processors

**Backend Integration (What We Keep):**
- **Backend Client** (`backend/client.ts`) - HTTP client for backend communication
- **Backend Provider** (`backend/provider.ts`) - virtual link provider for backend suggestions
- **Core Plugin Structure** - minimal plugin lifecycle and settings

**Key Constraints Discovered:**
- Implicit links manager is initialized in `main.ts:175` and triggers refresh on file changes
- Reference counting policy builds full vault indexes on startup and file changes
- Multiple UI initializers are called sequentially in `main.ts:130-139`
- Debounced event handlers trigger expensive operations every 1-3 seconds

## Desired End State
A minimal SNW plugin that:
1. Only initializes backend integration
2. Disables all implicit links detection
3. Disables all visual indicators and UI components
4. Disables reference counting and indexing
5. Maintains only the backend client and provider functionality
6. Can be tested to determine if freezing persists

**Verification:**
- Plugin loads without freezing
- Backend integration works (can register vault and query for related links)
- No implicit links scanning occurs
- No visual indicators are rendered
- No reference counting or indexing operations

## What We're NOT Doing
- Rewriting the backend integration code
- Changing the plugin architecture fundamentally
- Removing the ability to re-enable features later
- Changing the settings structure
- Modifying the build system

## Implementation Approach
Create a "minimal mode" by:
1. Adding a new setting flag for minimal mode
2. Conditionally skipping initialization of heavy features
3. Maintaining the existing code structure for easy reversion
4. Adding console logging to verify what's disabled

## Phases

### Phase 1: Add Minimal Mode Setting
**Goal**: Add a setting to enable minimal mode that disables all heavy features

**Tasks**:
- [ ] Add minimal mode setting to settings interface
- [ ] Update default settings to include minimal mode
- [ ] Add migration for existing settings

**Changes Required**:
- **File**: `src/settings.ts`
  - **Changes**: Add minimal mode setting to Settings interface and DEFAULT_SETTINGS
  - **Code**: 
    ```typescript
    export interface Settings {
      // ... existing settings ...
      minimalMode: boolean; // NEW: Enable minimal mode for debugging
    }
    
    export const DEFAULT_SETTINGS: Settings = {
      // ... existing settings ...
      minimalMode: false, // NEW: Default to full functionality
    };
    ```

- **File**: `src/settings.ts` (migration function)
  - **Changes**: Add minimal mode to migration function
  - **Code**:
    ```typescript
    export function migrateSettings(legacySettings: LegacySettings): Settings {
      return {
        // ... existing migration ...
        minimalMode: false, // NEW: Default for migrated settings
      };
    }
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] Settings interface includes minimalMode property
- [ ] Migration function handles minimalMode property

#### Manual Verification:
- [ ] Plugin loads without errors
- [ ] Settings tab shows minimal mode toggle
- [ ] Setting persists after restart

---

### Phase 2: Implement Minimal Mode Logic in Main Plugin
**Goal**: Modify main plugin to skip heavy feature initialization when minimal mode is enabled

**Tasks**:
- [ ] Add minimal mode checks in main plugin initialization
- [ ] Conditionally skip heavy feature initialization
- [ ] Add logging to verify what's disabled
- [ ] Keep lightweight initAPI() for backend provider registration

**Changes Required**:
- **File**: `src/main.ts`
  - **Changes**: Add minimal mode checks in onload() method with lightweight API initialization
  - **Code**:
    ```typescript
    async onload(): Promise<void> {
      console.log(`loading ${this.appName}`);
      
      // Load settings first
      await this.initSettings();
      
      // Always add settings tab so users can toggle back
      this.addSettingTab(new SettingsTab(this.app, this));
      
      if (this.settings.minimalMode) {
        console.log("SNW: 🚀 Minimal Mode ENABLED — Backend only");
        await this.initAPI({ minimal: true });  // lightweight, no CM6/MD processors
        await this.initBackend();               // registers provider, starts status polling
        return;
      }
      
      // Full initialization (existing code)
      this.featureManager = new FeatureManager(this, this.settings, this.showCountsActive);
      await this.referenceCountingPolicy.buildLinksAndReferences();
      await this.initUI();
      await this.initAPI();
      await this.initViews();
      await this.initDebouncedEvents();
      await this.initCommands();
      await this.initFeatureToggles();
      await this.initLayoutReadyHandler();
      await this.initBackend();
    }
    ```

- **File**: `src/main.ts`
  - **Changes**: Modify initAPI to support minimal mode
  - **Code**:
    ```typescript
    private async initAPI(options?: { minimal?: boolean }): Promise<void> {
      window.snwAPI = this.snwAPI; // API access to SNW for external use
      
      if (options?.minimal) {
        // Minimal mode: only expose what's needed for backend provider
        console.log("SNW: Minimal mode - lightweight API only");
        // Don't touch reference counts, index, or CM6 extensions
        return;
      }
      
      // Full mode: complete API setup
      this.snwAPI.references = this.referenceCountingPolicy.indexedReferences;
      this.snwAPI.settings = this.settings;
    }
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] No syntax errors in main.ts
- [ ] Plugin loads without throwing errors

#### Manual Verification:
- [ ] Plugin loads in minimal mode without freezing
- [ ] Console shows "Minimal mode enabled" message
- [ ] No heavy feature initialization occurs

---

### Phase 3: Disable Implicit Links in Minimal Mode
**Goal**: Ensure implicit links manager is not initialized when minimal mode is enabled

**Tasks**:
- [ ] Skip implicit links manager initialization in minimal mode
- [ ] Prevent implicit links refresh triggers

**Changes Required**:
- **File**: `src/main.ts`
  - **Changes**: Skip implicit links manager initialization in minimal mode
  - **Code**:
    ```typescript
    private async initSettings(): Promise<void> {
      await this.loadSettings();
      
      // Initialize diagnostic flags
      setDiagnosticFlags(this.settings.dev);
      
      if (this.settings.minimalMode) {
        console.log("SNW: Minimal mode - skipping reference counting and UI setup");
        return; // Settings tab added in onload() before this check
      }
      
      // Full settings initialization (existing code)
      this.referenceCountingPolicy.setActivePolicy(this.settings.wikilinkEquivalencePolicy);
      
      // Initialize implicit links manager (only in full mode)
      this.implicitLinksManager = new ImplicitLinksManager(this, this.settings.autoLinks);
      this.implicitLinksManager.registerProvider(this.snwAPI.registerVirtualLinkProvider.bind(this.snwAPI));
    }
    ```

- **File**: `src/main.ts`
  - **Changes**: Skip implicit links refresh in debounced events when in minimal mode
  - **Code**:
    ```typescript
    private async initDebouncedEvents(): Promise<void> {
      if (this.settings.minimalMode) {
        console.log("SNW: Minimal mode - skipping debounced event setup");
        return;
      }
      
      // ... existing debounced event setup ...
    }
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] No implicit links manager instantiation in minimal mode

#### Manual Verification:
- [ ] Console shows implicit links are skipped
- [ ] No implicit links scanning occurs
- [ ] No file change events trigger implicit links refresh

---

### Phase 4: Disable Reference Counting in Minimal Mode
**Goal**: Skip reference counting policy initialization and indexing when minimal mode is enabled

**Tasks**:
- [ ] Skip reference counting policy initialization in minimal mode
- [ ] Prevent reference counting operations

**Changes Required**:
- **File**: `src/main.ts`
  - **Changes**: Skip reference counting policy operations in minimal mode
  - **Code**:
    ```typescript
    async onload(): Promise<void> {
      // ... existing code ...
      
      if (this.settings.minimalMode) {
        console.log("SNW: Minimal mode enabled - skipping heavy features");
        // Only initialize backend integration
        await this.initBackend();
        return;
      }
      
      // Full initialization (existing code)
      this.featureManager = new FeatureManager(this, this.settings, this.showCountsActive);
      await this.referenceCountingPolicy.buildLinksAndReferences(); // SKIPPED in minimal mode
      // ... rest of initialization ...
    }
    ```

- **File**: `src/main.ts`
  - **Changes**: Skip reference counting in layout ready handler when in minimal mode
  - **Code**:
    ```typescript
    private async initLayoutReadyHandler(): Promise<void> {
      if (this.settings.minimalMode) {
        console.log("SNW: Minimal mode - skipping layout ready handler setup");
        return;
      }
      
      // ... existing layout ready handler code ...
    }
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] No reference counting policy operations in minimal mode

#### Manual Verification:
- [ ] Console shows reference counting is skipped
- [ ] No indexing operations occur on startup
- [ ] No file change events trigger indexing

---

### Phase 5: Disable UI Components in Minimal Mode
**Goal**: Skip all UI component initialization when minimal mode is enabled

**Tasks**:
- [ ] Skip UI initializers in minimal mode
- [ ] Skip views and commands initialization
- [ ] Skip feature toggles

**Changes Required**:
- **File**: `src/main.ts`
  - **Changes**: Skip UI initialization methods in minimal mode
  - **Code**:
    ```typescript
    async onload(): Promise<void> {
      // ... existing code ...
      
      if (this.settings.minimalMode) {
        console.log("SNW: Minimal mode enabled - skipping heavy features");
        // Only initialize backend integration
        await this.initBackend();
        return;
      }
      
      // Full initialization (existing code)
      this.featureManager = new FeatureManager(this, this.settings, this.showCountsActive);
      await this.referenceCountingPolicy.buildLinksAndReferences();
      await this.initUI(); // SKIPPED in minimal mode
      await this.initAPI(); // SKIPPED in minimal mode
      await this.initViews(); // SKIPPED in minimal mode
      await this.initDebouncedEvents(); // SKIPPED in minimal mode
      await this.initCommands(); // SKIPPED in minimal mode
      await this.initFeatureToggles(); // SKIPPED in minimal mode
      await this.initLayoutReadyHandler(); // SKIPPED in minimal mode
      await this.initBackend();
    }
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] No UI component initialization in minimal mode

#### Manual Verification:
- [ ] Console shows UI components are skipped
- [ ] No sidebar views are created
- [ ] No editor extensions are registered
- [ ] No commands are added

---

### Phase 6: Add Settings UI for Minimal Mode
**Goal**: Add a toggle in the settings UI to enable/disable minimal mode

**Tasks**:
- [ ] Add minimal mode toggle to settings tab
- [ ] Handle setting changes and plugin restart

**Changes Required**:
- **File**: `src/ui/SettingsTab.ts`
  - **Changes**: Add minimal mode setting to the settings UI with clear description
  - **Code**: 
    ```typescript
    // Add to the appropriate section of the settings UI
    new Setting(containerEl)
      .setName("Minimal Mode (Backend only)")
      .setDesc("Disable indexing, implicit links, and UI decorations. Only backend inferred links remain.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.minimalMode)
        .onChange(async (value) => {
          this.plugin.settings.minimalMode = value;
          await this.plugin.saveSettings();
          new Notice("SNW: Restart Obsidian to apply Minimal Mode.");
        })
      );
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] Settings tab includes minimal mode toggle

#### Manual Verification:
- [ ] Settings tab shows minimal mode toggle
- [ ] Toggle can be changed and saved
- [ ] Setting change shows restart notice

---

### Phase 7: Test Minimal Mode Functionality
**Goal**: Verify that minimal mode works correctly and only backend integration is active

**Tasks**:
- [ ] Test plugin loading in minimal mode
- [ ] Verify backend integration still works
- [ ] Confirm heavy features are disabled

**Changes Required**:
- **File**: `src/main.ts`
  - **Changes**: Add more detailed logging for minimal mode verification
  - **Code**:
    ```typescript
    async onload(): Promise<void> {
      console.log(`loading ${this.appName}`);
      
      // Load settings first
      await this.initSettings();
      
      // Always add settings tab so users can toggle back
      this.addSettingTab(new SettingsTab(this.app, this));
      
      if (this.settings.minimalMode) {
        console.log("SNW: 🚀 MINIMAL MODE ENABLED");
        console.log("SNW: ✅ Skipping: Feature Manager, Reference Counting, UI Components");
        console.log("SNW: ✅ Keeping: Backend Integration only");
        await this.initAPI({ minimal: true });  // lightweight, no CM6/MD processors
        await this.initBackend();               // registers provider, starts status polling
        console.log("SNW: 🎯 Minimal mode initialization complete");
        return;
      }
      
      console.log("SNW: 🔧 Full mode initialization");
      // ... existing full initialization code ...
    }
    ```

**Success Criteria**:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] Plugin loads without errors in minimal mode

#### Manual Verification:
- [ ] Console shows clear minimal mode messages
- [ ] Plugin loads quickly without freezing
- [ ] Backend integration can register vault and query for links
- [ ] No implicit links scanning occurs
- [ ] No visual indicators are rendered

---

## Dependencies
- Existing SNW plugin codebase must be intact
- Backend server must be running for testing
- Obsidian must support the plugin architecture

## Risks and Considerations
- **Risk**: Breaking existing functionality when minimal mode is disabled
  - **Mitigation**: Keep all existing code paths intact, only add conditional checks
- **Risk**: Backend integration may have hidden dependencies on disabled features
  - **Mitigation**: Test backend functionality thoroughly in minimal mode
- **Risk**: Settings migration may fail for existing users
  - **Mitigation**: Provide sensible defaults and handle migration gracefully

## Critical Implementation Details

### Zero Indexing Paths in Minimal Mode
Ensure that **anywhere** that calls these expensive operations is gated behind `if (!this.settings.minimalMode)`:

- `this.referenceCountingPolicy.buildLinksAndReferences()`
- Any Markdown post processors or CM6 extensions (gutters, inline counters, decorations)
- File change event handlers that trigger indexing
- Layout ready handlers that rebuild references

This avoids the heavy bits mentioned in the troubleshooting docs:
- Decorations can be expensive on big files
- Force rebuild/indexing hooks can cause stalls
- Background scanning operations should not run

### Minimal Mode Wiring (Safe Order)
1. **onload()**:
   - `await this.initSettings()`
   - `this.addSettingTab(new SettingsTab(this.app, this))` (always add)
   - If minimalMode:
     - `await this.initAPI({ minimal: true })` ← lightweight surface only
     - `await this.initBackend()` ← registers backend provider
     - `console.log("SNW: 🚀 Minimal mode: Backend-only active")`
     - `return;`
   - Else: proceed with full initialization

2. **initAPI({ minimal })**:
   - In minimal mode, do NOT touch reference counts, index, CodeMirror or markdown post-processors
   - Only expose the API method(s) needed for virtual link provider registration
   - Your backend provider will live in `src/backend/provider.ts`

3. **initBackend()**:
   - Ensure it does: `registerVirtualLinkProvider(backendProvider)`
   - Manages: POST /register on startup, GET /status poll, POST /query/related per active file
   - These are exactly what the backend contract specifies

## Testing Strategy

### Unit Tests:
- Settings interface includes minimalMode property
- Migration function handles minimalMode property
- Main plugin loads without errors in minimal mode

### Integration Tests:
- Plugin loads in minimal mode without freezing
- Backend integration works correctly in minimal mode
- Heavy features are completely disabled in minimal mode

### Manual Testing Steps:
1. **Clean Deploy** (critical to avoid CM6/runtime collisions):
   - Build: `npm run build`
   - Copy only these files to plugin folder:
     - `build/main.js`
     - `build/manifest.json` 
     - `build/styles.css`
   - Do NOT copy `node_modules` or source tree
2. Enable minimal mode in settings
3. Restart Obsidian
4. Verify plugin loads quickly without freezing
5. Check console for minimal mode messages
6. Test backend integration (register vault, query for links)
7. Verify no implicit links scanning occurs
8. Verify no visual indicators are rendered
9. Verify no reference counting operations occur

### Fast Verification Checklist:
- **Clean deploy** (build + copy only build artifacts)
- Enable plugin with Minimal Mode = ON
- Start example backend server (or your own)
- DevTools → Network: see POST /register → GET /status (becomes ready:true) → POST /query/related when switching files
- No visible counters/gutters; no large CPU spikes; no "rebuild index" logging

## Performance Considerations
- Minimal mode should load significantly faster than full mode
- No background indexing or scanning operations should occur
- Backend integration should be the only active feature

## Migration Notes
- Existing users will have `minimalMode: false` by default
- No data migration required
- Users can toggle between modes via settings

## References
- Original task: Fix freezing issues by isolating backend integration
- Main plugin file: `src/main.ts`
- Settings file: `src/settings.ts`
- Feature manager: `src/FeatureManager.ts`
- Implicit links: `src/implicit-links/`
- Backend integration: `src/backend/`

## Quick Implementation Snippets

### src/settings.ts
```typescript
export interface Settings {
  // ... existing ...
  minimalMode: boolean; // NEW
}

export const DEFAULT_SETTINGS: Settings = {
  // ... existing ...
  minimalMode: false,
};
```

### src/ui/SettingsTab.ts (add one toggle)
```typescript
new Setting(containerEl)
  .setName("Minimal Mode (Backend only)")
  .setDesc("Disable indexing, implicit links, and UI decorations. Only backend inferred links remain.")
  .addToggle(t => t.setValue(this.plugin.settings.minimalMode)
    .onChange(async (v) => {
      this.plugin.settings.minimalMode = v;
      await this.plugin.saveSettings();
      new Notice("SNW: Restart Obsidian to apply Minimal Mode.");
    }));
```

### src/main.ts (shape)
```typescript
async onload() {
  await this.initSettings();
  this.addSettingTab(new SettingsTab(this.app, this));

  if (this.settings.minimalMode) {
    console.log("SNW: 🚀 Minimal Mode ENABLED — Backend only");
    await this.initAPI({ minimal: true });  // lightweight, no CM6/MD processors
    await this.initBackend();               // registers provider, starts status polling
    return;
  }

  // Full mode
  this.featureManager = new FeatureManager(/* ... */);
  await this.referenceCountingPolicy.buildLinksAndReferences(); // heavy
  await this.initUI();
  await this.initAPI();
  await this.initViews();
  await this.initDebouncedEvents();
  await this.initCommands();
  await this.initFeatureToggles();
  await this.initLayoutReadyHandler();
  await this.initBackend();
}
```
