#!/usr/bin/env node

/**
 * Test script for implicit links functionality
 * Run this in the Obsidian console after enabling the plugin
 */

console.log("Testing SNW Implicit Links...");

// Test configuration
const testConfig = {
	detectionMode: "regex",
	regexRules: [
		{
			pattern: "\\bNatural Language Programming\\b",
			flags: "gi",
			targetTemplate: "Encyclopedia/${0}.md"
		},
		{
			pattern: "\\bMachine Learning\\b",
			flags: "gi", 
			targetTemplate: "AI/${0}.md",
			displayTemplate: "ML: ${0}"
		}
	]
};

// Test text
const testText = `
# Test Document

This document contains references to Natural Language Programming techniques.
We also discuss Machine Learning applications in various contexts.

Some other content here that should not be detected.
`;

console.log("Test configuration:", testConfig);
console.log("Test text:", testText);

// Function to test regex detection
function testRegexDetection() {
	console.log("\n=== Testing Regex Detection ===");
	
	for (const rule of testConfig.regexRules) {
		const regex = new RegExp(rule.pattern, rule.flags);
		let match;
		const matches = [];
		
		while ((match = regex.exec(testText)) !== null) {
			const span = { start: match.index, end: match.index + match[0].length };
			const display = rule.displayTemplate ? 
				rule.displayTemplate.replace(/\$\{(\d+)\}/g, (_, g) => match[Number(g)] ?? "") : 
				match[0];
			const targetPath = rule.targetTemplate.replace(/\$\{(\d+)\}/g, (_, g) => match[Number(g)] ?? "");
			
			matches.push({
				span,
				display,
				targetPath,
				source: "regex"
			});
		}
		
		console.log(`Rule "${rule.pattern}":`, matches);
	}
}

// Function to test conflict resolution
function testConflictResolution() {
	console.log("\n=== Testing Conflict Resolution ===");
	
	// Simulate overlapping matches
	const detected = [
		{ span: { start: 10, end: 20 }, display: "Natural Language Programming", targetPath: "Encyclopedia/Natural Language Programming.md", source: "regex" },
		{ span: { start: 15, end: 25 }, display: "Language Programming", targetPath: "Encyclopedia/Language Programming.md", source: "regex" },
		{ span: { start: 50, end: 65 }, display: "Machine Learning", targetPath: "AI/Machine Learning.md", source: "regex" }
	];
	
	// Sort by longest span first, then by start position
	detected.sort((a, b) => {
		const la = a.span.end - a.span.start;
		const lb = b.span.end - b.span.start;
		if (la !== lb) return lb - la; // longer first
		return a.span.start - b.span.start; // then earlier
	});
	
	// Apply conflict resolution
	const picked = [];
	let lastEnd = -1;
	for (const item of detected) {
		if (item.span.start >= lastEnd) {
			picked.push(item);
			lastEnd = item.span.end;
		}
	}
	
	console.log("Original detected:", detected);
	console.log("After conflict resolution:", picked);
}

// Run tests
testRegexDetection();
testConflictResolution();

console.log("\n=== Test Complete ===");
console.log("To test in Obsidian:");
console.log("1. Enable the plugin");
console.log("2. Set detectionMode to 'regex' in settings");
console.log("3. Add regex rules similar to the test config");
console.log("4. Create a test file with the test text");
console.log("5. Check if virtual links appear in the SNW sidebar");
