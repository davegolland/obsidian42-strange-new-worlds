// Fix Display Counts script
// This script fixes the display logic to show correct reference counts

console.log('🔧 SNW Fix Display Counts');
console.log('=========================');

// Wait for SNW to be available
function waitForSNW() {
    if (window.snwAPI) {
        fixDisplayCounts();
    } else {
        console.log('⏳ Waiting for SNW API...');
        setTimeout(waitForSNW, 1000);
    }
}

async function fixDisplayCounts() {
    console.log('✅ SNW API found, fixing display counts...');
    
    const plugin = window.snwAPI.plugin;
    const currentFile = plugin.app.workspace.getActiveFile();
    
    console.log(`📄 Current file: ${currentFile.path}`);
    
    // Get the SNW cache
    const snwCache = await plugin.referenceCountingPolicy.getSNWCacheByFile(currentFile);
    console.log('\n📊 SNW Cache:');
    console.log('- Links in cache:', snwCache.links?.length || 0);
    
    if (snwCache.links && snwCache.links.length > 0) {
        console.log('\n🔗 Links with correct reference counts:');
        snwCache.links.forEach((link, index) => {
            console.log(`  ${index + 1}. ${link.key}: ${link.references.length} references`);
        });
        
        // Remove existing SNW indicators
        console.log('\n🧹 Removing existing indicators...');
        const existingIndicators = document.querySelectorAll('.snw-ref-count');
        existingIndicators.forEach(indicator => {
            if (indicator.textContent !== 'TEST') { // Keep our test indicator
                indicator.remove();
            }
        });
        
        // Find internal links and create correct indicators
        console.log('\n🔧 Creating correct indicators...');
        const internalLinks = document.querySelectorAll('a.internal-link');
        console.log(`Found ${internalLinks.length} internal links in document`);
        
        internalLinks.forEach((link, index) => {
            const linkText = link.textContent;
            console.log(`Processing link ${index + 1}: "${linkText}"`);
            
            // Find the exact matching cache entry
            let cacheEntry = null;
            
            // Try exact match first
            cacheEntry = snwCache.links.find(l => 
                l.original === linkText || 
                l.key.includes(linkText.toUpperCase())
            );
            
            // If no exact match, try partial match
            if (!cacheEntry) {
                cacheEntry = snwCache.links.find(l => 
                    l.key.includes(linkText.toUpperCase()) ||
                    (l.original && l.original.includes(linkText))
                );
            }
            
            if (cacheEntry) {
                console.log(`  ✅ Found cache entry: ${cacheEntry.key} with ${cacheEntry.references.length} references`);
                
                // Create indicator element with correct count
                const indicator = document.createElement('span');
                indicator.className = 'snw-ref-count snw-ref-count-link';
                indicator.textContent = cacheEntry.references.length.toString();
                indicator.style.cssText = `
                    display: inline-block;
                    background: #007acc;
                    color: white;
                    border-radius: 3px;
                    padding: 1px 4px;
                    font-size: 10px;
                    font-weight: bold;
                    margin-left: 4px;
                    cursor: pointer;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                `;
                
                // Add click handler
                indicator.addEventListener('click', () => {
                    console.log(`Clicked indicator for ${cacheEntry.key} (${cacheEntry.references.length} references)`);
                    // You can add SNW view activation here if needed
                });
                
                // Insert after the link
                link.parentNode.insertBefore(indicator, link.nextSibling);
                console.log(`  ✅ Added indicator: ${cacheEntry.references.length}`);
            } else {
                console.log(`  ❌ No cache entry found for: "${linkText}"`);
            }
        });
        
        console.log('\n💡 Results:');
        console.log('1. Check if the reference counts are now correct');
        console.log('2. You should see: 3, 8, 8, 4 (not all 3s)');
        console.log('3. The indicators should match the cache values');
        
    } else {
        console.log('❌ No links found in cache');
    }
}

// Start the fix
waitForSNW();
