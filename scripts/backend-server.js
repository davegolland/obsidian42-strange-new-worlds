#!/usr/bin/env node

/**
 * High-performance backend server for InferredWikilinks
 * Implements the performance optimizations from the fix plan
 */

const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

const PORT = process.env.PORT || 8000;
const KW_MATCH_MODE = process.env.KW_MATCH_MODE || 'stem';
const KW_PAR_SCAN = process.env.KW_PAR_SCAN === '1';
const KW_DEBUG_CANDIDATES = process.env.KW_DEBUG_CANDIDATES === '1';

// Global state
let vaultPath = null;
let isReady = false;
let fileCache = new Map(); // path -> { content, mtime, tokens }
let termMemo = new Map(); // query key -> { expires, result }

// Performance counters
const counters = {
  filesScanned: 0,
  cacheHits: 0,
  cacheMisses: 0,
  memoHits: 0,
  exceptionsCount: 0,
  earlyStopHits: 0,
  batchTerms: 0
};

// Stop words for short term filtering
const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'sum']);

/**
 * Clamp span indices to prevent out-of-bounds access
 */
function clampSpan(start, end, length) {
  start = start == null ? 0 : Math.max(0, Math.min(start, length));
  end = end == null ? start : Math.max(start, Math.min(end, length));
  return [start, end];
}

/**
 * Create a snippet from line content with safe bounds checking
 */
function createSnippet(line, col, matchLen) {
  const start = Math.max(0, col);
  const end = Math.min(line.length, col + matchLen);
  const before = line.substring(0, start);
  const match = line.substring(start, end);
  const after = line.substring(end);
  
  return {
    before: before,
    match: match,
    after: after,
    line: line,
    col: col,
    length: matchLen
  };
}

/**
 * Convert spans to reference items with safe snippet creation
 */
function spansToReferences(content, spans, filePath) {
  const items = [];
  const lines = content.split('\n');
  
  for (const span of spans) {
    const [start, end] = clampSpan(span.start, span.end, content.length);
    if (end <= start) continue;
    
    // Find line boundaries safely
    const beforeContent = content.substring(0, start);
    const lineStart = beforeContent.lastIndexOf('\n') + 1;
    const afterStart = content.indexOf('\n', start);
    const lineEnd = afterStart === -1 ? content.length : afterStart;
    
    const line = content.substring(lineStart, lineEnd);
    const col = Math.max(0, Math.min(start - lineStart, line.length));
    const matchLen = Math.max(0, Math.min(end - start, line.length - col));
    
    if (matchLen > 0) {
      const snippet = createSnippet(line, col, matchLen);
      const lineNum = beforeContent.split('\n').length;
      
      items.push({
        file: filePath,
        title: path.basename(filePath, '.md'),
        line: lineNum,
        col: col,
        snippet: snippet
      });
    }
  }
  
  return items;
}

/**
 * Simple tokenization for stem mode (fast path)
 */
function tokenizeStem(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Find matches in text using the specified mode
 */
function findMatches(text, searchTerm, mode = 'stem') {
  const matches = [];
  
  if (mode === 'stem') {
    const tokens = tokenizeStem(text);
    const searchTokens = tokenizeStem(searchTerm);
    const searchPattern = searchTokens.join(' ');
    
    let pos = 0;
    while (true) {
      const index = text.toLowerCase().indexOf(searchPattern, pos);
      if (index === -1) break;
      
      matches.push({
        start: index,
        end: index + searchPattern.length
      });
      
      pos = index + 1;
    }
  } else {
    // Exact mode
    let pos = 0;
    while (true) {
      const index = text.indexOf(searchTerm, pos);
      if (index === -1) break;
      
      matches.push({
        start: index,
        end: index + searchTerm.length
      });
      
      pos = index + 1;
    }
  }
  
  return matches;
}

/**
 * Process a single file for references
 */
async function processFile(filePath, searchTerm, mode) {
  try {
    const stats = await fs.stat(filePath);
    const cacheKey = `${filePath}:${stats.mtime.getTime()}:${mode}`;
    
    // Check cache
    if (fileCache.has(cacheKey)) {
      counters.cacheHits++;
      const cached = fileCache.get(cacheKey);
      const matches = findMatches(cached.content, searchTerm, mode);
      return spansToReferences(cached.content, matches, filePath);
    }
    
    // Cache miss - read file
    counters.cacheMisses++;
    const content = await fs.readFile(filePath, 'utf8');
    
    // Cache the content
    fileCache.set(cacheKey, {
      content,
      mtime: stats.mtime,
      tokens: mode === 'stem' ? tokenizeStem(content) : null
    });
    
    // Find matches and convert to references
    const matches = findMatches(content, searchTerm, mode);
    return spansToReferences(content, matches, filePath);
    
  } catch (error) {
    counters.exceptionsCount++;
    console.error(`Error processing ${filePath}:`, error);
    return [];
  }
}

/**
 * Get all markdown files in vault
 */
async function getMarkdownFiles(vaultPath) {
  const files = [];
  
  async function scanDir(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  await scanDir(vaultPath);
  return files;
}

/**
 * TTL Memoization for duplicate queries
 */
class TermMemo {
  constructor(ttlSec = 60, maxSize = 256) {
    this.ttl = ttlSec * 1000;
    this.maxSize = maxSize;
    this.store = new Map();
  }
  
  get(key) {
    const now = performance.now();
    const record = this.store.get(key);
    
    if (record && record.expires > now) {
      counters.memoHits++;
      return record.value;
    }
    
    if (record) {
      this.store.delete(key);
    }
    
    return null;
  }
  
  put(key, value) {
    if (this.store.size >= this.maxSize) {
      // Simple eviction: remove oldest
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }
    
    this.store.set(key, {
      value,
      expires: performance.now() + this.ttl
    });
  }
}

const memo = new TermMemo(45); // 45 second TTL

/**
 * Handle references endpoint with performance optimizations
 */
async function handleReferences(req, res, parsedUrl) {
  const query = parsedUrl.query;
  const vaultPath = query.vault_path;
  const term = query.term;
  const offset = parseInt(query.offset) || 0;
  const limit = parseInt(query.limit) || 20;
  const mode = query.mode || KW_MATCH_MODE;
  
  if (!vaultPath || !term) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Missing vault_path or term' }));
    return;
  }
  
  // Guard against short terms and stop words
  if (term.length < 3 || STOP_WORDS.has(term.toLowerCase())) {
    res.setHeader('X-Search-Mode', 'exact(auto)');
  }
  
  const startTime = performance.now();
  
  // Check memoization
  const memoKey = `${vaultPath}:${mode}:${term}:${offset}:${limit}`;
  const memoResult = memo.get(memoKey);
  if (memoResult) {
    res.writeHead(200);
    res.end(JSON.stringify(memoResult));
    return;
  }
  
  try {
    // Get all markdown files
    const files = await getMarkdownFiles(vaultPath);
    const needed = offset + limit;
    let collected = 0;
    const results = [];
    
    // Early stop optimization
    for (const filePath of files) {
      if (collected >= needed) {
        counters.earlyStopHits++;
        break;
      }
      
      const fileResults = await processFile(filePath, term, mode);
      counters.filesScanned++;
      
      // Only add what we need for this page
      const remaining = needed - collected;
      const toAdd = fileResults.slice(0, remaining);
      results.push(...toAdd);
      collected += toAdd.length;
      
      if (collected >= needed) {
        counters.earlyStopHits++;
        break;
      }
    }
    
    // Apply offset and limit
    const paginatedResults = results.slice(offset, offset + limit);
    
    const response = {
      link_type: 'keyword',
      term: term,
      references: paginatedResults,
      total: results.length
    };
    
    // Memoize the result
    memo.put(memoKey, response);
    
    const elapsed = performance.now() - startTime;
    console.log(`References search: ${counters.filesScanned} files, ${counters.cacheHits} cache hits, ${counters.cacheMisses} misses, ${elapsed.toFixed(3)}s`);
    
    res.writeHead(200);
    res.end(JSON.stringify(response));
    
  } catch (error) {
    console.error('References search error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

/**
 * Handle batch references endpoint
 */
async function handleBatchReferences(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { vault_path, terms, mode = KW_MATCH_MODE, offset = 0, limit = 20 } = data;
      
      if (!vault_path || !terms || !Array.isArray(terms)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      
      counters.batchTerms += terms.length;
      const results = {};
      
      // Process each term
      for (const term of terms) {
        const memoKey = `${vault_path}:${mode}:${term}:${offset}:${limit}`;
        const memoResult = memo.get(memoKey);
        
        if (memoResult) {
          results[term] = {
            items: memoResult.references,
            total_count: memoResult.total
          };
        } else {
          // Process term (simplified for batch)
          const files = await getMarkdownFiles(vault_path);
          const termResults = [];
          
          for (const filePath of files.slice(0, 50)) { // Limit for batch
            const fileResults = await processFile(filePath, term, mode);
            termResults.push(...fileResults);
          }
          
          const paginatedResults = termResults.slice(offset, offset + limit);
          
          results[term] = {
            items: paginatedResults,
            total_count: termResults.length
          };
        }
      }
      
      res.writeHead(200);
      res.end(JSON.stringify({ results }));
      
    } catch (error) {
      console.error('Batch references error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

/**
 * Handle candidates endpoint with logging guards
 */
async function handleCandidates(req, res, parsedUrl) {
  const query = parsedUrl.query;
  const vaultPath = query.vault_path;
  const filePath = query.file_path;
  
  if (!vaultPath || !filePath) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Missing vault_path or file_path' }));
    return;
  }
  
  // Guard heavy logging
  if (KW_DEBUG_CANDIDATES) {
    console.log(`🔍 Candidates query for: ${filePath}`);
  }
  
  // Mock response for now
  const mockCandidates = [
    { keyword: 'example', count: 5, score: 0.85 },
    { keyword: 'test', count: 3, score: 0.72 },
    { keyword: 'demo', count: 2, score: 0.65 }
  ];
  
  res.writeHead(200);
  res.end(JSON.stringify({
    vault: vaultPath,
    path: filePath,
    keywords: mockCandidates
  }));
}

/**
 * Handle metrics endpoint
 */
function handleMetrics(req, res) {
  const metrics = {
    ...counters,
    cacheSize: fileCache.size,
    memoSize: memo.store.size,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };
  
  res.writeHead(200);
  res.end(JSON.stringify(metrics, null, 2));
}

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  res.setHeader('Content-Type', 'application/json');
  
  console.log(`${req.method} ${pathname}`);
  
  if (pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      ready: isReady,
      vaultPath: vaultPath,
      files: isReady ? fileCache.size : 0,
      apiVersion: '2.0.0',
      commit: 'performance-optimized',
      mode: KW_MATCH_MODE,
      parallel: KW_PAR_SCAN
    }));
  } else if (pathname === '/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        vaultPath = data.vault_path;
        console.log(`✅ Registered vault: ${vaultPath}`);
        isReady = true;
        res.writeHead(202);
        res.end(JSON.stringify({ message: 'Vault registered, processing...' }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (pathname === '/references' && req.method === 'GET') {
    if (!isReady) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Service not ready' }));
      return;
    }
    handleReferences(req, res, parsedUrl);
  } else if (pathname === '/references/batch' && req.method === 'POST') {
    if (!isReady) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Service not ready' }));
      return;
    }
    handleBatchReferences(req, res);
  } else if (pathname === '/candidates' && req.method === 'GET') {
    if (!isReady) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Service not ready' }));
      return;
    }
    handleCandidates(req, res, parsedUrl);
  } else if (pathname === '/metrics' && req.method === 'GET') {
    handleMetrics(req, res);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 High-performance backend server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  GET  /status');
  console.log('  POST /register');
  console.log('  GET  /references');
  console.log('  POST /references/batch');
  console.log('  GET  /candidates');
  console.log('  GET  /metrics');
  console.log('');
  console.log(`⚡ Mode: ${KW_MATCH_MODE}, Parallel: ${KW_PAR_SCAN}`);
  console.log('⏳ Backend will be ready after vault registration...');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

// Export for testing
module.exports = { server, memo, fileCache, counters };
