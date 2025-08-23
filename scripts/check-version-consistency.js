#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageVersion = packageJson.version;

// Read CHANGELOG.md and extract the top version
const changelogContent = fs.readFileSync('docs/CHANGELOG.md', 'utf8');
const firstLine = changelogContent.split('\n')[0];
const changelogVersion = firstLine.replace('# ', '').trim();

console.log(`Package.json version: ${packageVersion}`);
console.log(`CHANGELOG top version: ${changelogVersion}`);

if (packageVersion !== changelogVersion) {
  console.error('❌ ERROR: Version mismatch!');
  console.error(`   Package.json: ${packageVersion}`);
  console.error(`   CHANGELOG: ${changelogVersion}`);
  console.error('   Please update the CHANGELOG.md to match package.json version.');
  process.exit(1);
}

console.log('✅ Version consistency check passed!');
