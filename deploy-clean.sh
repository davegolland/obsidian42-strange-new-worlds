#!/bin/bash

# Deploy Clean Plugin Build
# This script deploys only the built files to the vault plugin folder
# without any node_modules or source files to avoid CM6 conflicts

echo "🔧 Deploying clean plugin build..."

# Use VAULT_PATH if set, otherwise default
ROOT="${VAULT_PATH:-/Users/dave/temp/vault/techniques/techniques}"

# Configuration - update these paths for your setup
VAULT_PLUGIN_DIR="$ROOT/.obsidian/plugins/obsidian42-inferred-wikilinks"
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

# Manifest file is already copied by esbuild config
echo "📋 Manifest file already in build directory"

# Media directory removed - no longer copying media files

# Verify deployment
echo "✅ Deployment complete!"
echo "📂 Plugin folder contents:"
ls -la "$VAULT_PLUGIN_DIR"

echo ""
echo "🔍 Verifying no node_modules present..."
if [ -d "$VAULT_PLUGIN_DIR/node_modules" ]; then
    echo "⚠️  WARNING: node_modules found in plugin folder!"
    echo "   This may cause CM6 extension errors."
else
    echo "✅ No node_modules found - clean deployment!"
fi

echo ""
echo "🔐 Main plugin file MD5 hash:"
if [ -f "$VAULT_PLUGIN_DIR/main.js" ]; then
    MAIN_JS_MD5=$(md5 -q "$VAULT_PLUGIN_DIR/main.js")
    echo "   main.js: $MAIN_JS_MD5"
else
    echo "   ⚠️  main.js not found in plugin directory"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Restart Obsidian"
echo "2. Enable the InferredWikilinks plugin"
echo "3. Check console for CM6 path logs"
echo "4. Test for 'Unrecognized extension value' errors"
echo ""
echo "Expected console output:"
echo "  [implicit-links] CM6 paths:"
echo "  STATE PATH /path/to/app.asar/node_modules/@codemirror/state/..."
echo "  VIEW PATH  /path/to/app.asar/node_modules/@codemirror/view/..."






