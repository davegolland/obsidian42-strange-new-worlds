// Quick smoke test for inline counters functionality
// Run this in the browser console while viewing a markdown file

console.log("🧪 Testing inline counters functionality...");

// Test 1: Check if inline counters are rendering
const inlineCounters = document.querySelectorAll('.snw-liveupdate');
console.log(`✅ Found ${inlineCounters.length} inline counters`);

// Test 2: Check for explicit links (should not have double badges)
const explicitLinks = document.querySelectorAll('a.internal-link');
let doubleBadgeCount = 0;
explicitLinks.forEach(link => {
    const parent = link.parentElement;
    if (parent && parent.querySelector('.snw-liveupdate')) {
        doubleBadgeCount++;
        console.warn(`⚠️  Double badge detected on explicit link:`, link.textContent);
    }
});

if (doubleBadgeCount === 0) {
    console.log("✅ No double badges found on explicit links");
} else {
    console.warn(`⚠️  Found ${doubleBadgeCount} explicit links with double badges`);
}

// Test 3: Check for implicit links
const implicitLinks = document.querySelectorAll('.snw-implicit-link');
console.log(`✅ Found ${implicitLinks.length} implicit links`);

// Test 4: Check for implicit badges
const implicitBadges = document.querySelectorAll('.snw-implicit-badge');
console.log(`✅ Found ${implicitBadges.length} implicit badges`);

// Test 5: Verify no inline code has badges
const codeBlocks = document.querySelectorAll('code');
let codeWithBadges = 0;
codeBlocks.forEach(code => {
    if (code.querySelector('.snw-liveupdate, .snw-implicit-badge')) {
        codeWithBadges++;
        console.warn(`⚠️  Badge found inside code block:`, code.textContent);
    }
});

if (codeWithBadges === 0) {
    console.log("✅ No badges found inside code blocks");
} else {
    console.warn(`⚠️  Found ${codeWithBadges} code blocks with badges`);
}

console.log("🎉 Inline counters test complete!");
