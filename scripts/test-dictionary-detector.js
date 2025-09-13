#!/usr/bin/env node

/**
 * Test script for dictionary-based implicit links functionality
 * Run this in the Obsidian console after enabling the plugin
 */

console.log("Testing InferredWikilinks Dictionary Detector...");

// Test configuration
const testConfig = {
	detectionMode: "dictionary",
	dictionary: {
		sources: {
			basenames: true,
			aliases: true,
			headings: false
		},
		minPhraseLength: 3,
		requireWordBoundaries: true
	}
};

// Simulated vault structure
const mockVault = [
	{
		path: "My Note.md",
		basename: "My Note",
		aliases: ["My Note", "Note"],
		headings: ["Introduction", "Conclusion"]
	},
	{
		path: "Project Ideas.md", 
		basename: "Project Ideas",
		aliases: ["Ideas", "Projects"],
		headings: ["Web App", "Mobile App", "API Design"]
	},
	{
		path: "Machine Learning.md",
		basename: "Machine Learning", 
		aliases: ["ML", "AI"],
		headings: ["Neural Networks", "Deep Learning"]
	}
];

// Test text
const testText = `
# Test Document

This document mentions several notes from the vault.

I have some ideas for My Note that I want to explore.
The Project Ideas document contains many interesting concepts.
We should look at Machine Learning techniques for this.

Some other content that should not be detected.
`;

console.log("Test configuration:", testConfig);
console.log("Mock vault structure:", mockVault);
console.log("Test text:", testText);

// Function to simulate dictionary building
function buildDictionary(vault, config) {
	const dictionary = new Map();
	const phrases = [];
	
	for (const file of vault) {
		const names = [];
		
		if (config.dictionary.sources.basenames) {
			names.push(file.basename);
		}
		if (config.dictionary.sources.aliases) {
			names.push(...file.aliases);
		}
		if (config.dictionary.sources.headings) {
			names.push(...file.headings);
		}
		
		for (const name of names) {
			const trimmed = name.trim();
			if (!trimmed) continue;
			if (config.dictionary.minPhraseLength > trimmed.length) continue;
			
			// Simple normalization (case-insensitive)
			const key = trimmed.toLowerCase();
			if (!dictionary.has(key)) {
				dictionary.set(key, { path: file.path, display: trimmed });
				phrases.push(trimmed);
			}
		}
	}
	
	return { dictionary, phrases };
}

// Function to simulate text scanning
function scanText(text, phrases, requireWordBoundaries) {
	const matches = [];
	
	for (const phrase of phrases) {
		const regex = requireWordBoundaries 
			? new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
			: new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
		
		let match;
		while ((match = regex.exec(text)) !== null) {
			matches.push({
				phrase: phrase,
				span: { start: match.index, end: match.index + match[0].length },
				match: match[0]
			});
		}
	}
	
	return matches;
}

// Function to resolve overlaps
function resolveOverlaps(matches) {
	// Sort by longest span first, then by start position
	matches.sort((a, b) => {
		const la = a.span.end - a.span.start;
		const lb = b.span.end - b.span.start;
		if (la !== lb) return lb - la; // longer first
		return a.span.start - b.span.start; // then earlier
	});
	
	const picked = [];
	let lastEnd = -1;
	for (const match of matches) {
		if (match.span.start >= lastEnd) {
			picked.push(match);
			lastEnd = match.span.end;
		}
	}
	
	return picked;
}

// Run the test
function testDictionaryDetection() {
	console.log("\n=== Testing Dictionary Detection ===");
	
	// Build dictionary
	const { dictionary, phrases } = buildDictionary(mockVault, testConfig);
	console.log("Built dictionary phrases:", phrases);
	console.log("Dictionary entries:", Array.from(dictionary.entries()));
	
	// Scan text
	const matches = scanText(testText, phrases, testConfig.dictionary.requireWordBoundaries);
	console.log("Raw matches:", matches);
	
	// Resolve overlaps
	const resolved = resolveOverlaps(matches);
	console.log("After overlap resolution:", resolved);
	
	// Map to final results
	const results = resolved.map(match => {
		const key = match.phrase.toLowerCase();
		const target = dictionary.get(key);
		return {
			span: match.span,
			display: match.match,
			targetPath: target.path,
			source: "dictionary"
		};
	});
	
	console.log("Final detected links:", results);
}

// Test word boundary functionality
function testWordBoundaries() {
	console.log("\n=== Testing Word Boundaries ===");
	
	const testCases = [
		"Machine Learning is interesting",
		"MachineLearning is not a match",
		"My Note contains ideas",
		"MyNote is not a match"
	];
	
	for (const testCase of testCases) {
		console.log(`\nTesting: "${testCase}"`);
		const matches = scanText(testCase, ["Machine Learning", "My Note"], true);
		console.log("Matches:", matches);
	}
}

// Run tests
testDictionaryDetection();
testWordBoundaries();

console.log("\n=== Test Complete ===");
console.log("To test in Obsidian:");
console.log("1. Enable the plugin");
console.log("2. Set detectionMode to 'dictionary' in settings");
console.log("3. Configure dictionary sources (basenames, aliases, headings)");
console.log("4. Create test files with the mock vault structure");
console.log("5. Check if virtual links appear in the InferredWikilinks sidebar");
