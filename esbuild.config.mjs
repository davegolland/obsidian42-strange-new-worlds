import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';
import fs from 'fs';
import console from 'console';
import path from 'path';

fs.copyFile('manifest.json', 'build/manifest.json', (err) => {
  if (err) console.log(err);
});

// Create styles directory in build if it doesn't exist
if (!fs.existsSync('build/styles')) {
  fs.mkdirSync('build/styles', { recursive: true });
}

// Instead of just copying the files, let's combine all CSS files into one
const concatenateCss = () => {
  // Create a combined CSS file for build/styles.css
  const commonCss = fs.readFileSync('styles/common.css', 'utf8');
  const inlineCss = fs.readFileSync('styles/inline.css', 'utf8');
  const gutterCss = fs.readFileSync('styles/gutter.css', 'utf8');
  const popoverCss = fs.readFileSync('styles/popover.css', 'utf8');
  const sidepaneCss = fs.readFileSync('styles/sidepane.css', 'utf8');
  
  const combinedCss = `/* Combined modular CSS */
${commonCss}
${inlineCss}
${gutterCss}
${popoverCss}
${sidepaneCss}`;
  
  fs.writeFileSync('build/styles.css', combinedCss);
  
  // Also copy individual files for reference
  const styleFiles = ['common.css', 'inline.css', 'gutter.css', 'popover.css', 'sidepane.css', 'main.css'];
  styleFiles.forEach(file => {
    fs.copyFile(path.join('styles', file), path.join('build/styles', file), (err) => {
      if (err) console.log(err);
    });
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
  process.exit(0);
} else {
  await context.watch();
}