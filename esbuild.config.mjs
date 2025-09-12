import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Ensure build directory exists
if (!fs.existsSync('build')) {
  fs.mkdirSync('build', { recursive: true });
}

// Copy manifest.json synchronously to avoid race conditions
try {
  fs.copyFileSync('manifest.json', 'build/manifest.json');
} catch (err) {
  console.error('Error copying manifest.json:', err);
  process.exit(1);
}

// Create styles directory in build if it doesn't exist
if (!fs.existsSync('build/styles')) {
  fs.mkdirSync('build/styles', { recursive: true });
}

// Instead of just copying the files, let's combine all CSS files into one
const concatenateCss = () => {
  // Read the main CSS file which imports all modules
  const mainCss = fs.readFileSync('styles/main.css', 'utf8');
  
  // Process the imports to get the actual content
  const processedCss = mainCss.replace(/@import "([^"]+)";/g, (match, importPath) => {
    const fullPath = path.join('styles', importPath);
    return fs.readFileSync(fullPath, 'utf8');
  });
  
  const combinedCss = `/* Combined modular CSS */
${processedCss}`;
  
  fs.writeFileSync('build/styles.css', combinedCss);
  
  // Also copy individual files for reference
  const styleFiles = ['common.css', 'inline.css', 'gutter.css', 'popover.css', 'sidepane.css', 'main.css'];
  styleFiles.forEach(file => {
    try {
      fs.copyFileSync(path.join('styles', file), path.join('build/styles', file));
    } catch (err) {
      console.error(`Error copying ${file}:`, err);
    }
  });
};

concatenateCss();

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: prod,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'build/main.js',
});

if (prod) {
  console.log('Building for production');
  await context.rebuild();
  
  // Run build cleanliness check
  try {
    console.log('🔍 Checking build cleanliness...');
    execSync('node scripts/check-build-clean.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build cleanliness check failed');
    process.exit(1);
  }
  
  // Run version consistency check
  try {
    console.log('🔍 Checking version consistency...');
    execSync('node scripts/check-version-consistency.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Version consistency check failed');
    process.exit(1);
  }
  
  process.exit(0);
} else {
  await context.watch();
}