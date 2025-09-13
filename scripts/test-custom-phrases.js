#!/usr/bin/env node

/**
 * Test script for custom phrases functionality
 * Run this in the Obsidian console after enabling the plugin
 */

console.log("Testing InferredWikilinks Custom Phrases...");

// Test configuration with custom phrases
const testConfig = {
	detectionMode: "dictionary",
	dictionary: {
		sources: {
			basenames: false,
			aliases: false,
			headings: false,
			customList: true
		},
		minPhraseLength: 3,
		requireWordBoundaries: true,
		customPhrases: [
			"Natural Language Processing",
			"Machine Learning",
			"Artificial Intelligence",
			"Deep Learning",
			"Neural Networks"
		]
	}
};

// Test text
const testText = `
# Test Document

This document mentions several AI and ML concepts.

Natural Language Processing is becoming more important.
Machine Learning techniques are everywhere.
Artificial Intelligence is transforming industries.
Deep Learning models are getting larger.
Neural Networks are the foundation of modern AI.

Some other content that should not be detected.
`;

console.log("Test configuration:", testConfig);
console.log("Test text:", testText);

// Function to simulate custom phrase detection
function testCustomPhraseDetection() {
	console.log("\n=== Testing Custom Phrase Detection ===");
	
	const customPhrases = testConfig.dictionary.customPhrases;
	const matches = [];
	
	for (const phrase of customPhrases) {
		// Simple word boundary matching
		const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
		let match;
		
		while ((match = regex.exec(testText)) !== null) {
			matches.push({
				phrase: phrase,
				span: { start: match.index, end: match.index + match[0].length },
				match: match[0]
			});
		}
	}
	
	console.log("Raw matches:", matches);
	
	// Resolve overlaps (longest span wins)
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
	
	console.log("After overlap resolution:", picked);
	
	// Map to final results
	const results = picked.map(match => ({
		span: match.span,
		display: match.match,
		targetPath: "Custom Phrase Target.md", // In real implementation, this would point to a specific file
		source: "dictionary"
	}));
	
	console.log("Final detected links:", results);
}

// Function to test phrase management
function testPhraseManagement() {
	console.log("\n=== Testing Phrase Management ===");
	
	const phrases = [
		"Short",           // Too short (5 chars, but min is 3)
		"Very Long Phrase That Should Be Detected",
		"Mixed Case Phrase",  // Should match regardless of case
		"Special-Characters", // Should handle special chars
		"Numbers 123"         // Should handle numbers
	];
	
	console.log("Test phrases:", phrases);
	
	// Filter by minimum length
	const filtered = phrases.filter(phrase => phrase.length >= testConfig.dictionary.minPhraseLength);
	console.log("After min length filter:", filtered);
	
	// Test case sensitivity
	const testCase = "mixed case phrase";
	const matches = filtered.filter(phrase => 
		testCase.toLowerCase().includes(phrase.toLowerCase())
	);
	console.log(`Matches for "${testCase}":`, matches);
}

// Run tests
testCustomPhraseDetection();
testPhraseManagement();

console.log("\n=== Test Complete ===");
console.log("To test in Obsidian:");
console.log("1. Enable the plugin");
console.log("2. Set detectionMode to 'dictionary' in settings");
console.log("3. Enable 'Include Custom Phrases'");
console.log("4. Add custom phrases in the settings");
console.log("5. Create a test file with the test text");
console.log("6. Check if virtual links appear in the InferredWikilinks sidebar");
