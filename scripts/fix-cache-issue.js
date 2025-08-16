// Fix Cache Issue script
// This script uses the correct method to process links and populate cache

console.log('🔧 SNW Cache Fix Script');
console.log('=======================');

// Wait for SNW to be available
function waitForSNW() {
    if (window.snwAPI) {
        fixCacheIssue();
    } else {
        console.log('⏳ Waiting for SNW API...');
        setTimeout(waitForSNW, 1000);
    }
}

async function fixCacheIssue() {
    console.log('✅ SNW API found, fixing cache issue...');
    
    const plugin = window.snwAPI.plugin;
    const currentFile = plugin.app.workspace.getActiveFile();
    
    console.log(`📄 Current file: ${currentFile.path}`);
    
    // Get Obsidian cache
    const obsidianCache = plugin.app.metadataCache.getFileCache(currentFile);
    console.log('\n📊 Obsidian Cache:');
    console.log('- Links:', obsidianCache?.links?.length || 0);
    
    if (obsidianCache?.links) {
        console.log('\n🔗 Obsidian Links:');
        obsidianCache.links.forEach((link, index) => {
            console.log(`  ${index + 1}. ${link.link} (line ${link.position.start.line})`);
        });
    }
    
    // Use the correct method to process the file
    console.log('\n🔧 Processing file with correct method...');
    try {
        // Use the existing method that should work
        plugin.referenceCountingPolicy.getLinkReferencesForFile(currentFile, obsidianCache);
        
        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check cache again
        const snwCache = plugin.referenceCountingPolicy.getSNWCacheByFile(currentFile);
        console.log('SNW cache after processing:', snwCache);
        
        if (snwCache) {
            console.log('- Links in cache:', snwCache.links?.length || 0);
            console.log('- Headings in cache:', snwCache.headings?.length || 0);
            console.log('- Embeds in cache:', snwCache.embeds?.length || 0);
            console.log('- Blocks in cache:', snwCache.blocks?.length || 0);
        }
        
        // Force UI update
        plugin.app.workspace.updateOptions();
        
        // Check DOM
        const snwElements = document.querySelectorAll('[class*="snw"]');
        console.log(`SNW elements in DOM: ${snwElements.length}`);
        
        // If still no cache, try a different approach
        if (!snwCache || snwCache.links?.length === 0) {
            console.log('\n🔄 Trying alternative approach...');
            
            // Try to manually create cache entries
            if (obsidianCache?.links) {
                console.log('Manually creating cache entries...');
                
                // Force rebuild the entire index
                await plugin.referenceCountingPolicy.buildLinksAndReferences();
                
                // Check cache again
                const newSnwCache = plugin.referenceCountingPolicy.getSNWCacheByFile(currentFile);
                console.log('SNW cache after full rebuild:', newSnwCache);
                
                if (newSnwCache) {
                    console.log('- Links in new cache:', newSnwCache.links?.length || 0);
                }
                
                // Force UI update again
                plugin.app.workspace.updateOptions();
                
                // Check DOM again
                const newSnwElements = document.querySelectorAll('[class*="snw"]');
                console.log(`SNW elements after rebuild: ${newSnwElements.length}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error during processing:', error);
    }
    
    console.log('\n💡 Results:');
    console.log('1. Check if you see reference indicators now');
    console.log('2. If not, try switching to Live Preview mode');
    console.log('3. The cache should now be populated correctly');
}

// Start the fix
waitForSNW();
