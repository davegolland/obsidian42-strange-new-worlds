#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageVersion = packageJson.version;

// Check if CHANGELOG.md exists
const changelogPath = 'docs/CHANGELOG.md';
let changelogVersion = null;

if (fs.existsSync(changelogPath)) {
  // Read CHANGELOG.md and extract the top version
  const changelogContent = fs.readFileSync(changelogPath, 'utf8');
  const firstLine = changelogContent.split('\n')[0];
  changelogVersion = firstLine.replace('# ', '').trim();
  console.log(`Package.json version: ${packageVersion}`);
  console.log(`CHANGELOG top version: ${changelogVersion}`);
  
  if (packageVersion !== changelogVersion) {
    console.error('❌ ERROR: Version mismatch!');
    console.error(`   Package.json: ${packageVersion}`);
    console.error(`   CHANGELOG: ${changelogVersion}`);
    console.error('   Please update the CHANGELOG.md to match package.json version.');
    process.exit(1);
  }
} else {
  console.log(`Package.json version: ${packageVersion}`);
  console.log('ℹ️  CHANGELOG.md not found - skipping version consistency check');
}

console.log('✅ Version consistency check passed!');
