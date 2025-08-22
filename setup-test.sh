#!/bin/bash

# Define paths
VAULT_PATH="$HOME/Documents/testvault/testvault"
PLUGIN_PATH="$VAULT_PATH/.obsidian/plugins/obsidian42-strange-new-worlds-dev"

# Build the plugin
echo "Building plugin..."
npm run build

# Create plugin directory if it doesn't exist
mkdir -p "$PLUGIN_PATH"

# Copy necessary files
cp build/main.js build/manifest.json build/styles.css "$PLUGIN_PATH/"

echo "Plugin files copied to $PLUGIN_PATH"
echo "Please restart Obsidian and enable the plugin in Settings → Community plugins" 