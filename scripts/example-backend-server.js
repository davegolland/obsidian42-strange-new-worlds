#!/usr/bin/env node

/**
 * Example backend server for testing SNW backend integration
 * Run with: node scripts/example-backend-server.js
 */

const http = require('http');
const url = require('url');

const PORT = 8000;
let vaultPath = null;
let isReady = false;

// Simulate processing delay
setTimeout(() => {
  isReady = true;
  console.log('✅ Backend is now ready');
}, 3000);

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Set content type for JSON responses
  res.setHeader('Content-Type', 'application/json');

  console.log(`${req.method} ${path}`);

  if (path === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      ready: isReady,
      vaultPath: vaultPath,
      files: isReady ? 1234 : 0,
      apiVersion: '1.0.0',
      commit: 'example-123'
    }));
  } else if (path === '/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        vaultPath = data.vault_path;
        console.log(`✅ Registered vault: ${vaultPath}`);
        res.writeHead(202);
        res.end(JSON.stringify({ message: 'Vault registered, processing...' }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (path === '/query/related' && req.method === 'POST') {
    if (!isReady) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Service not ready' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(`🔍 Query for: ${data.file}`);
        
        // Mock response with example links
        const mockItems = [
          {
            path: 'related-note-1.md',
            reason: 'Similar topic discussed',
            score: 0.85
          },
          {
            path: 'related-note-2.md',
            reason: 'References same concept',
            score: 0.72
          },
          {
            path: 'related-note-3.md',
            reason: 'Shared keywords',
            score: 0.65
          }
        ];

        res.writeHead(200);
        res.end(JSON.stringify({ items: mockItems }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Example backend server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  GET  /status');
  console.log('  POST /register');
  console.log('  POST /query/related');
  console.log('');
  console.log('⏳ Backend will be ready in 3 seconds...');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
