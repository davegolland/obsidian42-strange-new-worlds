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

// No need to create styles directory since we only output styles.css

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
  
  // Individual CSS files are not needed in build - only the combined styles.css is used
};

concatenateCss();

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: prod,
  define: {
    'process.env.SNW_MINIMAL': JSON.stringify(process.env.SNW_MINIMAL || 'false'),
    'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
  },
  drop: prod ? ['console', 'debugger'] : [],
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