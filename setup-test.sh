#!/bin/bash

# Test deployment script - thin wrapper around deploy-clean.sh
# This script deploys to a test vault for development

echo "🧪 Deploying to test vault..."

# Set the test vault path
export TEST_VAULT_PATH="$HOME/Documents/testvault/testvault"

# Call the main deploy script with test vault path
ROOT="$TEST_VAULT_PATH"
VAULT_PLUGIN_DIR="$ROOT/.obsidian/plugins/obsidian42-strange-new-worlds-dev"
BUILD_DIR="./build"

# Clean and rebuild the plugin
echo "🧹 Cleaning previous build..."
rm -rf "$BUILD_DIR"

echo "🔨 Building plugin..."
npm run build

# Check if build was successful
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build failed. Build directory not found."
    exit 1
fi

if [ ! -f "$BUILD_DIR/main.js" ]; then
    echo "❌ Build failed. main.js not found in build directory."
    exit 1
fi

# Create plugin directory if it doesn't exist
mkdir -p "$VAULT_PLUGIN_DIR"

echo "📁 Cleaning existing plugin folder..."
rm -rf "$VAULT_PLUGIN_DIR"/*

echo "📦 Copying built files..."
cp -r "$BUILD_DIR"/* "$VAULT_PLUGIN_DIR/"

echo "✅ Test deployment complete!"
echo "📂 Plugin folder contents:"
ls -la "$VAULT_PLUGIN_DIR"

echo ""
echo "🎯 Next steps:"
echo "1. Restart Obsidian"
echo "2. Enable the SNW plugin in Settings → Community plugins" 