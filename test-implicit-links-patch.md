# Test Implicit Links Patch 4 - Stable CM6 Extension

This file tests the refined implicit links system with stable StateField/StateEffect pattern and accurate reference counting.

## Test Custom Phrases

The following phrases should be detected as implicit links with numbered badges:

- hello world
- abcdefg
- Natural Language Processing
- Machine Learning
- Artificial Intelligence

## Test Regular Content

This is just regular content that should not be detected as links.

## Test Mixed Content

Here we have some content with hello world embedded in it, and also abcdefg appearing naturally in the text.

The phrases should show up with:
1. Dotted underlines with proper styling
2. **Accurate reference count badges** (explicit SNW refs + 1 + target self-hits)
3. **Rich hover popovers** showing detailed reference breakdown
4. Click to navigate functionality

## Expected Behavior After Patch 4

After applying the patch and reloading the plugin:

1. **Custom phrases should render reliably**: Both "hello world" and "abcdefg" should appear with dotted underlines and numbered badges
2. **Accurate reference counting**: Badges show `explicitCount + 1 + targetSelf` where:
   - `explicitCount`: SNW explicit references across the vault
   - `1`: This occurrence in the current document
   - `targetSelf`: Occurrences in the target file itself
3. **Rich hover experience**: Hovering shows detailed popover with:
   - List of files that reference this term (from SNW's indexedReferences)
   - Current document occurrence with context
   - Target file self-references
4. **Fallback detection**: Custom phrases are detected even if dictionary build misses them
5. **Settings update without reload**: Adding/removing custom phrases works immediately

## Key Improvements in Patch 4

- **Stable StateField/StateEffect pattern**: Uses proper CodeMirror state management
- **Accurate reference counting**: Uses SNW's actual reference data with proper aggregation
- **Robust hover system**: Tries SNW's native popover first, falls back to lightweight tippy
- **Direct custom phrase scanning**: Scans document text directly with regex for reliability
- **Two-phase decoration**: Initial render + quick update for accurate self-hit counts
- **Clean integration**: Uses existing CM6 extension pattern

## Console Output

You should see console messages like:
```
[ImplicitLinks cm6] custom-phrase scan error [error details]
```

This is normal if there are any issues with custom phrase scanning.

## Testing the Patch 4 System

To test the new system:

1. **Build and reload**: The new system should activate automatically
2. **Add custom phrases**: Configure "hello world" and "abcdefg" in settings
3. **Check badges**: Should show accurate counts (≥2 for "hello world" in your test)
4. **Test hover**: Should show rich popover with reference breakdown
5. **Test click**: Should navigate to target files
6. **Test fallback**: Even if dictionary build misses phrases, they should still appear

## Architecture Notes

The new system:
- Uses stable StateField/StateEffect pattern for proper state management
- Implements two-phase decoration for accurate counts
- Provides multiple fallback mechanisms for reliability
- Integrates cleanly with existing SNW systems
- Uses CSS variables for consistent theming
- Handles async file reading for self-hit counting

## Sanity Checklist

After build and reload:
1. ✅ Settings → SNW → Include Custom Phrases = ON, abcdefg present
2. ✅ Reload plugin
3. ✅ In a note containing "hello world" and "abcdefg", see underline + badge for both
4. ✅ Counts should be ≥2 when target note contains the term
5. ✅ Hover on badge: shows SNW references popover or lightweight list

If decorations don't appear, run in dev console:
```javascript
document.querySelectorAll('.cm-content .snw-implicit-link').length
```
- `> 0` → decorations exist (CSS/theme issue unlikely)
- `0` but console logs "decorating N" → ensure `initImplicitLinksLivePreview(plugin)` runs in initUI
