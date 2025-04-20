DEV_NOTES.MD

# Updating the version

1. update package.json version number
2. npm run version (updates the manifest and versions.json files)
3. commit repo
4. npm run tag-version (creates a git tag for the version number and pushes it to the repo, which kicks off the github action to prepare the release)

Note: You can also use the `--dry-run` flag with both commands to see what changes would be made without actually making them:
- `node scripts/release.mjs --local --dry-run`
- `node scripts/release.mjs --ci --dry-run`
