// Test script to verify the rendering fixes
// Run this in Obsidian console after reloading the plugin

console.log('=== Testing SNW Rendering Fixes ===');

// Check if plugin is loaded
const plugin = window.snwAPI?.plugin;
if (!plugin) {
    console.error('❌ Plugin not found - window.snwAPI.plugin is undefined');
    process.exit(1);
}

console.log('✅ Plugin loaded:', plugin.appName);

// Check if show counts is active
console.log('✅ Show counts active:', plugin.showCountsActive);

// Check if indexed references exist
const indexedRefs = plugin.referenceCountingPolicy?.indexedReferences;
if (!indexedRefs || indexedRefs.size === 0) {
    console.error('❌ No indexed references found - index may not be built');
    console.log('Indexed refs size:', indexedRefs?.size || 0);
} else {
    console.log('✅ Indexed references found:', indexedRefs.size);
}

// Test getSNWCacheByFile is synchronous
const activeFile = app.workspace.getActiveFile();
if (activeFile) {
    console.log('✅ Testing getSNWCacheByFile with active file:', activeFile.path);
    
    try {
        const cache = plugin.referenceCountingPolicy.getSNWCacheByFile(activeFile);
        console.log('✅ getSNWCacheByFile returned:', typeof cache);
        console.log('✅ Cache has links:', !!(cache?.links?.length));
        console.log('✅ Cache has headings:', !!(cache?.headings?.length));
        console.log('✅ Cache has blocks:', !!(cache?.blocks?.length));
    } catch (error) {
        console.error('❌ Error calling getSNWCacheByFile:', error);
    }
} else {
    console.log('⚠️  No active file to test with');
}

// Test API call
try {
    const apiResult = window.snwAPI.getMetaInfoByFileName(activeFile?.path || '');
    console.log('✅ API call successful:', typeof apiResult);
} catch (error) {
    console.error('❌ Error calling API:', error);
}

console.log('=== Test Complete ===');
