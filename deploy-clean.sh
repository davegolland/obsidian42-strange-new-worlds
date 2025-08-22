#!/bin/bash

# Deploy Clean Plugin Build
# This script deploys only the built files to the vault plugin folder
# without any node_modules or source files to avoid CM6 conflicts

echo "🔧 Deploying clean plugin build..."

# Configuration - update these paths for your setup
VAULT_PLUGIN_DIR="$HOME/.obsidian/plugins/obsidian42-strange-new-worlds"
BUILD_DIR="./build"

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found. Run 'npm run build' first."
    exit 1
fi

# Create plugin directory if it doesn't exist
mkdir -p "$VAULT_PLUGIN_DIR"

echo "📁 Cleaning existing plugin folder..."
rm -rf "$VAULT_PLUGIN_DIR"/*

echo "📦 Copying built files..."
cp -r "$BUILD_DIR"/* "$VAULT_PLUGIN_DIR/"

# Copy media if it exists
if [ -d "./media" ]; then
    echo "🖼️  Copying media files..."
    cp -r "./media" "$VAULT_PLUGIN_DIR/"
fi

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
echo "🎯 Next steps:"
echo "1. Restart Obsidian"
echo "2. Enable the SNW plugin"
echo "3. Check console for CM6 path logs"
echo "4. Test for 'Unrecognized extension value' errors"
echo ""
echo "Expected console output:"
echo "  [implicit-links] CM6 paths:"
echo "  STATE PATH /path/to/app.asar/node_modules/@codemirror/state/..."
echo "  VIEW PATH  /path/to/app.asar/node_modules/@codemirror/view/..."






