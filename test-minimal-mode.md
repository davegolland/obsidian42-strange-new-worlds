# Testing Minimal Mode Implementation

## What We've Implemented

### Phase 1: ✅ Minimal Mode Setting
- Added `minimalMode: boolean` to Settings interface
- Added to DEFAULT_SETTINGS (defaults to `false`)
- Added to migration function for backward compatibility

### Phase 2: ✅ Minimal Mode Logic in Main Plugin
- Modified `onload()` method to check `minimalMode` setting
- When enabled: only calls `initAPI({ minimal: true })` and `initBackend()`
- When disabled: runs full initialization (existing behavior)
- Always initializes FeatureManager (needed for settings updates)
- Added detailed console logging for both modes

### Phase 3: ✅ Disable Implicit Links in Minimal Mode
- Modified `initSettings()` to skip implicit links manager initialization
- Added early return when `minimalMode` is enabled
- FeatureManager is always initialized and updated (needed for settings management)

### Phase 4: ✅ Disable Reference Counting in Minimal Mode
- Modified `initDebouncedEvents()` to skip all debounced event setup
- Added early return when `minimalMode` is enabled

### Phase 5: ✅ Disable UI Components in Minimal Mode
- Modified `initLayoutReadyHandler()` to skip layout ready handler setup
- Added early return when `minimalMode` is enabled

### Phase 6: ✅ Settings UI for Minimal Mode
- Added "Debug & Performance" section to settings
- Added toggle for "Minimal Mode (Backend only)"
- Shows restart notice when changed

### Phase 7: ✅ Enhanced Logging
- Added detailed console logging for minimal mode
- Shows what's being skipped and what's being kept

### Phase 8: ✅ Additional Minimal Mode Protections
- Added minimal mode checks to all expensive operations
- Protected event handlers from executing in minimal mode
- Protected layout ready handler from indexing operations
- Protected rebuild index command from running in minimal mode
- Protected all UI update calls with minimal mode checks

## Testing Steps

### 1. Build and Deploy
```bash
npm run build
# Copy build artifacts to Obsidian plugin folder
```

### 2. Test Settings UI
- Open Obsidian Settings → Community Plugins → Strange New Worlds
- Look for "Debug & Performance" section
- Verify "Minimal Mode (Backend only)" toggle exists
- Toggle it ON and save

### 3. Test Minimal Mode Loading
- Restart Obsidian
- Open Developer Console (Ctrl+Shift+I / Cmd+Option+I)
- Look for these console messages:
  ```
  SNW: 🚀 MINIMAL MODE ENABLED
  SNW: ✅ Skipping: Reference Counting, UI Components
  SNW: ✅ Keeping: Backend Integration and Feature Manager
  SNW: Minimal mode - skipping reference counting and UI setup
  SNW: Minimal mode - lightweight API only
  SNW: Minimal mode - skipping UI component initialization
  SNW: Minimal mode - skipping views and editor extensions
  SNW: Minimal mode - skipping debounced event setup
  SNW: Minimal mode - skipping feature toggles
  SNW: Minimal mode - skipping layout ready handler setup
  SNW: 🎯 Minimal mode initialization complete
  ```

### 4. Test Full Mode Loading
- Disable minimal mode in settings
- Restart Obsidian
- Look for these console messages:
  ```
  SNW: 🔧 Full mode initialization
  SNW: Minimal mode - skipping reference counting and UI setup
  ```

### 5. Verify Backend Integration Still Works
- Enable backend in settings
- Set backend URL (e.g., http://localhost:8000)
- Check that backend provider is registered
- Verify no errors in console

### 6. Verify Heavy Features Are Disabled
- No implicit links scanning should occur
- No reference counting operations should run
- No UI components should be initialized
- No debounced events should be set up
- No layout ready handlers should run

## Expected Behavior

### Minimal Mode (minimalMode: true)
- ✅ Plugin loads quickly without freezing
- ✅ Only backend integration is active
- ✅ No heavy feature initialization (except FeatureManager for settings)
- ✅ Console shows clear minimal mode messages
- ✅ Settings tab is accessible

### Full Mode (minimalMode: false)
- ✅ All existing functionality works as before
- ✅ Feature manager, reference counting, UI components all initialize
- ✅ Console shows full mode initialization

## Troubleshooting

### If Minimal Mode Still Freezes
- Check console for any error messages
- Verify that all heavy features are being skipped
- Look for any remaining initialization calls

### If Backend Integration Doesn't Work
- Check that `initBackend()` is still being called
- Verify backend provider registration
- Check network requests in DevTools

### If Settings Don't Persist
- Verify settings are being saved correctly
- Check that migration function handles minimalMode
- Restart Obsidian after changing settings

## Files Modified

1. **`src/settings.ts`**
   - Added `minimalMode` to Settings interface
   - Added to DEFAULT_SETTINGS and migration function

2. **`src/main.ts`**
   - Modified `onload()` method for minimal mode logic
   - Modified `initAPI()` to support minimal mode
   - Modified `initSettings()` to skip heavy features
   - FeatureManager always initialized and updated for settings management
   - Modified `initDebouncedEvents()` to skip in minimal mode
   - Modified `initLayoutReadyHandler()` to skip in minimal mode
   - Added detailed logging

3. **`src/ui/SettingsTab.ts`**
   - Added minimal mode toggle to settings UI
   - Added Notice import for restart message

## Success Criteria

- [ ] Plugin loads without freezing in minimal mode
- [ ] Console shows clear minimal mode messages
- [ ] Backend integration still works
- [ ] Heavy features are completely disabled
- [ ] Settings toggle works and persists
- [ ] Full mode still works when disabled
- [ ] No TypeScript compilation errors
- [ ] Build completes successfully
