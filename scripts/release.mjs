#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { exit } from 'process';

const exec = promisify(execCallback);

// Parse command-line arguments
const args = process.argv.slice(2);
const isLocalMode = args.includes('--local');
const isCIMode = args.includes('--ci');
const isDryRun = args.includes('--dry-run');

// Main function to handle the release process
async function main() {
  // If neither mode is specified, show usage information
  if (!isLocalMode && !isCIMode) {
    console.log('Usage: node scripts/release.mjs [--local | --ci] [--dry-run]');
    console.log('  --local     Update version files based on package.json version');
    console.log('  --ci        Tag and push the current version');
    console.log('  --dry-run   Show operations without executing them');
    exit(1);
  }

  // Get the version from package.json if in local mode
  let version;
  if (isLocalMode) {
    version = process.env.npm_package_version;
    if (!version) {
      console.error('Error: npm_package_version environment variable not found.');
      console.error('This script should be run through npm version command.');
      exit(1);
    }
  }

  // Update manifest.json and versions.json if in local mode
  if (isLocalMode) {
    try {
      // Read and update manifest.json
      const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
      const { minAppVersion } = manifest;
      manifest.version = version;
      
      if (!isDryRun) {
        writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));
        console.log(`Updated manifest.json to version ${version}`);
      } else {
        console.log(`[DRY RUN] Would update manifest.json to version ${version}`);
      }

      // Read and update versions.json
      const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
      versions[version] = minAppVersion;
      
      if (!isDryRun) {
        writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
        console.log(`Updated versions.json with version ${version} and minAppVersion ${minAppVersion}`);
      } else {
        console.log(`[DRY RUN] Would update versions.json with version ${version} and minAppVersion ${minAppVersion}`);
      }
    } catch (error) {
      console.error(`Error updating version files: ${error.message}`);
      exit(1);
    }
  }

  // Create git tag and push if in CI mode
  if (isCIMode) {
    try {
      // Read version from manifest.json
      const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
      version = manifest.version;
      
      const gitCommand = `git tag -a ${version} -m "${version}" && git push origin ${version}`;
      
      if (!isDryRun) {
        console.log(`Creating and pushing git tag for version ${version}...`);
        try {
          const { stdout, stderr } = await exec(gitCommand);
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
          console.log(`Successfully tagged and pushed version ${version}`);
        } catch (error) {
          console.error(`Git command error: ${error.message}`);
          exit(1);
        }
      } else {
        console.log(`[DRY RUN] Would create and push git tag for version ${version}`);
        console.log(`[DRY RUN] Git command: ${gitCommand}`);
      }
    } catch (error) {
      console.error(`Error reading manifest or pushing git tag: ${error.message}`);
      exit(1);
    }
  }
}

// Run the main function
main().catch(error => {
  console.error(`Unexpected error: ${error.message}`);
  exit(1);
}); 