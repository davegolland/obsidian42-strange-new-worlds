#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check if build directory contains node_modules
const buildDir = path.join(__dirname, '..', 'build');
const nodeModulesPath = path.join(buildDir, 'node_modules');

if (fs.existsSync(nodeModulesPath)) {
  console.error('❌ ERROR: node_modules found in build directory!');
  console.error('   This will cause CM6 extension conflicts.');
  console.error('   Please use deploy-clean.sh for deployment.');
  process.exit(1);
}

// Check for other problematic files/directories
const problematicItems = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'esbuild.config.mjs',
  'src/',
  'node_modules/'
];

for (const item of problematicItems) {
  const itemPath = path.join(buildDir, item);
  if (fs.existsSync(itemPath)) {
    console.warn(`⚠️  WARNING: ${item} found in build directory`);
    console.warn('   This may cause issues in production.');
  }
}

console.log('✅ Build directory is clean - safe for deployment');
