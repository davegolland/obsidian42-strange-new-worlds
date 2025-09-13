// Test script for Virtual Links feature
// This can be run in the Obsidian console to test the new functionality

console.log('Testing Virtual Links feature...');

// Wait for InferredWikilinks to be available
function waitForInferredWikilinks() {
    if (window.inferredWikilinksAPI) {
        testVirtualLinks();
    } else {
        setTimeout(waitForInferredWikilinks, 1000);
    }
}

function testVirtualLinks() {
    console.log('InferredWikilinks API found, testing Virtual Links...');
    
    // Test 1: Simple frontmatter provider
    const frontmatterProvider = window.inferredWikilinksAPI.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
        const links = [];
        
        // Treat 'related' frontmatter property as links
        if (cache?.frontmatter?.related) {
            if (Array.isArray(cache.frontmatter.related)) {
                cache.frontmatter.related.forEach(noteName => {
                    links.push(makeLink(String(noteName), `Related: ${noteName}`));
                });
            }
        }
        
        // Treat 'tags' as links to tag pages
        if (cache?.frontmatter?.tags) {
            if (Array.isArray(cache.frontmatter.tags)) {
                cache.frontmatter.tags.forEach(tag => {
                    links.push(makeLink(`tags/${tag}`, `Tag: ${tag}`));
                });
            }
        }
        
        console.log(`Virtual Links provider found ${links.length} links for ${file.path}`);
        return links;
    });
    
    // Test 2: Path-based provider
    const pathProvider = window.inferredWikilinksAPI.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
        const links = [];
        
        // Create links based on file path patterns
        if (file.path.startsWith('projects/')) {
            links.push(makeLink('templates/project', 'Project Template'));
            links.push(makeLink('projects/overview', 'Projects Overview'));
        }
        
        if (file.path.startsWith('daily/')) {
            links.push(makeLink('templates/daily', 'Daily Template'));
            links.push(makeLink('daily/archive', 'Daily Archive'));
        }
        
        if (links.length > 0) {
            console.log(`Path provider found ${links.length} links for ${file.path}`);
        }
        
        return links;
    });
    
    // Test 3: Content-based provider
    const contentProvider = window.inferredWikilinksAPI.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
        const links = [];
        
        // Create links based on file content
        if (cache?.sections) {
            cache.sections.forEach(section => {
                if (section.type === 'list') {
                    section.items?.forEach(item => {
                        if (item.task) {
                            links.push(makeLink(`tasks/${item.task}`, `Task: ${item.task}`));
                        }
                    });
                }
            });
        }
        
        if (links.length > 0) {
            console.log(`Content provider found ${links.length} links for ${file.path}`);
        }
        
        return links;
    });
    
    console.log('Virtual Links providers registered successfully!');
    console.log('Providers will be active for all files. Check the InferredWikilinks sidebar and gutters for virtual links.');
    console.log('To unregister providers, call: frontmatterProvider(); pathProvider(); contentProvider();');
    
    // Store unregister functions globally for easy access
    window.testVirtualLinksUnregister = () => {
        frontmatterProvider();
        pathProvider();
        contentProvider();
        console.log('Virtual Links providers unregistered');
    };
}

// Start the test
waitForInferredWikilinks();
