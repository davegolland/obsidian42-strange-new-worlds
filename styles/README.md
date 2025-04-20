# CSS Structure for Obsidian42 Strange New Worlds

This directory contains the modular CSS files for the Obsidian42 Strange New Worlds plugin.

## File Organization

- `main.css` - Main entry point that imports all other CSS files
- `common.css` - Common variables and shared styles
- `inline.css` - Styles for inline references and counters
- `gutter.css` - Styles for gutter-related elements
- `popover.css` - Styles for popovers and tooltips
- `sidepane.css` - Styles for the sidepane UI

## Modular CSS Benefits

1. **Easier Maintenance**: Each file focuses on a specific feature area
2. **Better Organization**: Styles are grouped by feature
3. **Collaboration**: Team members can work on different CSS modules
4. **Selective Loading**: Only load the CSS needed for specific features

## Development Process

When working on CSS:
1. Identify the feature area being styled
2. Locate the appropriate CSS file
3. Make changes to only that file
4. Test the changes with the plugin in a real vault

## Build Process

The build process automatically:
1. Copies all CSS files to the `build/styles` directory
2. Creates a compatibility `styles.css` file in the root of the build directory 