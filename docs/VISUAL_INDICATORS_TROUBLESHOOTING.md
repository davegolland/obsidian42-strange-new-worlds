# Visual Indicators Troubleshooting Guide

If you're not seeing visual indicators (reference counts) in your Obsidian vault, this guide will help you diagnose and fix the issue.

## Quick Fix Scripts

### 1. Automatic Fix Script
Run this in the Obsidian console to automatically fix common issues:
```javascript
// Copy and paste the contents of scripts/fix-cache-issue.js
```

### 2. Diagnostic Script
Run this to get detailed information about what's wrong:
```javascript
// Copy and paste the contents of scripts/fix-display-counts.js
```

## Common Issues and Solutions

### 1. No References in Index
**Symptoms**: No visual indicators anywhere, even on files with links
**Solution**: 
- Run the fix script above
- Or manually run: `plugin.referenceCountingPolicy.buildLinksAndReferences()`

### 2. Features Disabled in Settings
**Symptoms**: Plugin is loaded but no indicators show
**Check these settings**:
- **Startup**: Enable on desktop/mobile
- **Display**: Inline references in Live Preview/Reading view
- **Embed**: References in gutter (desktop/mobile)

### 3. Minimum Reference Count Threshold
**Symptoms**: Some indicators missing, others show
**Solution**: 
- Check Settings → Thresholds → "Minimal required count to show counter"
- Default is 1, but you might have set it higher

### 4. File Exclusion
**Symptoms**: Indicators work on some files but not others
**Check**:
- File frontmatter for `snw-file-exclude: true`
- File frontmatter for `snw-canvas-exclude-edit: true`
- Obsidian's excluded files list (Settings → Files & Links)

### 5. Reference Types Disabled
**Symptoms**: Some types of references show, others don't
**Check these settings**:
- **Reading Mode**: Block ID, Embeds, Links, Headers
- **Live Preview Mode**: Block ID, Embeds, Links, Headers

### 6. Source Mode Issues
**Symptoms**: Indicators work in Live Preview but not Source Mode
**Solution**: 
- Enable "Show SNW indicators in Source Mode" in settings
- Note: This is off by default since Source Mode is for raw markdown

### 7. Mobile vs Desktop Differences
**Symptoms**: Works on desktop but not mobile (or vice versa)
**Check**:
- Startup settings for your platform
- Gutter settings for your platform
- Property reference settings for your platform

## Manual Troubleshooting Steps

### Step 1: Check Plugin State
```javascript
// In Obsidian console
console.log('Plugin loaded:', !!window.snwAPI?.plugin);
console.log('Show counts active:', window.snwAPI?.plugin?.showCountsActive);
console.log('References in index:', window.snwAPI?.plugin?.referenceCountingPolicy?.indexedReferences?.size);
```

### Step 2: Check Current File
```javascript
// In Obsidian console
const activeFile = app.workspace.getActiveFile();
const cache = window.snwAPI?.plugin?.referenceCountingPolicy?.getSNWCacheByFile(activeFile);
console.log('Current file cache:', cache);
```

### Step 3: Force Rebuild
```javascript
// In Obsidian console
await window.snwAPI?.plugin?.referenceCountingPolicy?.buildLinksAndReferences();
window.snwAPI?.plugin?.app?.workspace?.updateOptions();
```

### Step 4: Check Settings
```javascript
// In Obsidian console
const settings = window.snwAPI?.plugin?.settings;
console.log('Settings:', {
    startup: settings.startup,
    display: settings.display,
    embed: settings.embed,
    minimumRefCountThreshold: settings.minimumRefCountThreshold
});
```

## What Visual Indicators Should Show

### Inline References (Live Preview/Reading View)
- **Links**: `[[PageName]]` → Shows reference count after the link
- **Embeds**: `![[PageName]]` → Shows reference count after the embed
- **Headers**: `# Heading` → Shows reference count after the header
- **Block IDs**: `text ^block-id` → Shows reference count after the block

### Gutter References (Live Preview Only)
- **Embeds on their own line**: Shows reference count in the left gutter
- Only appears when embeds are on separate lines
- Requires "Embed references in Gutter" setting enabled

### Header Count
- Shows total incoming links count in the document header
- Requires "Incoming Links Header Count" setting enabled

### Properties Panel
- Shows reference counts in the file properties panel
- Requires "Show references in properties" setting enabled

## Testing with Sample Content

Create a test file with this content to verify indicators are working:

```markdown
# Test Heading

This is a test file with various reference types.

[[Test Page]] - This should show a reference count
![[Test Page]] - This should show a reference count

Some text with a block ID ^test-block

## Another Heading

More content here.
```

If you don't see indicators on this content, run the diagnostic script to identify the issue.

## Still Not Working?

1. **Restart Obsidian** - Sometimes a full restart is needed
2. **Check for conflicts** - Disable other plugins temporarily
3. **Check console errors** - Look for JavaScript errors in the console
4. **Verify file content** - Make sure files actually contain links/embeds/headings
5. **Check file permissions** - Ensure Obsidian can read your vault files

## Getting Help

If none of these solutions work:
1. Run the diagnostic script and share the output
2. Check the Obsidian console for any error messages
3. Verify your Obsidian and plugin versions are up to date
4. Create a minimal test vault to isolate the issue
