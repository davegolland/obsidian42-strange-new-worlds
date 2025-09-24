#!/usr/bin/env node

/**
 * Performance test script for the optimized backend server
 * Tests all the performance optimizations from the fix plan
 */

const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:8000';
const TEST_VAULT = process.env.TEST_VAULT || '/tmp/test-vault';

// Test data
const TEST_TERMS = ['quantize', 'sum', 'each', 'selected', 'embedding', 'compression'];
const BATCH_TERMS = ['quantize', 'embedding compression', 'meta-embeddings'];

// Performance tracking
const results = {
  singleTerm: [],
  batchTerm: [],
  memoization: [],
  errorCount: 0,
  totalTests: 0
};

/**
 * Make HTTP request and measure performance
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        try {
          const jsonData = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: jsonData,
            duration: duration,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body,
            duration: duration,
            headers: res.headers,
            error: e.message
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Test server status
 */
async function testStatus() {
  console.log('🔍 Testing server status...');
  const result = await makeRequest('GET', '/status');
  
  if (result.status === 200) {
    console.log('✅ Server is running');
    console.log(`   Mode: ${result.data.mode}`);
    console.log(`   Parallel: ${result.data.parallel}`);
    return true;
  } else {
    console.log('❌ Server not responding');
    return false;
  }
}

/**
 * Register test vault
 */
async function registerVault() {
  console.log('📁 Registering test vault...');
  const result = await makeRequest('POST', '/register', {
    vault_path: TEST_VAULT
  });
  
  if (result.status === 202) {
    console.log('✅ Vault registered');
    return true;
  } else {
    console.log('❌ Vault registration failed:', result.data);
    return false;
  }
}

/**
 * Test single term references with performance measurement
 */
async function testSingleTermReferences() {
  console.log('\n🔍 Testing single term references...');
  
  for (const term of TEST_TERMS) {
    console.log(`   Testing term: "${term}"`);
    
    const result = await makeRequest('GET', `/references?vault_path=${encodeURIComponent(TEST_VAULT)}&term=${encodeURIComponent(term)}&offset=0&limit=20`);
    
    if (result.status === 200) {
      const data = result.data;
      console.log(`   ✅ Found ${data.references.length} references in ${result.duration.toFixed(2)}ms`);
      
      results.singleTerm.push({
        term: term,
        duration: result.duration,
        count: data.references.length,
        total: data.total,
        mode: result.headers['x-search-mode'] || 'default'
      });
      
      // Test memoization (repeat same query)
      const memoResult = await makeRequest('GET', `/references?vault_path=${encodeURIComponent(TEST_VAULT)}&term=${encodeURIComponent(term)}&offset=0&limit=20`);
      
      if (memoResult.status === 200) {
        const memoDuration = memoResult.duration;
        const speedup = result.duration / memoDuration;
        
        console.log(`   🚀 Memoized query: ${memoDuration.toFixed(2)}ms (${speedup.toFixed(1)}x faster)`);
        
        results.memoization.push({
          term: term,
          originalDuration: result.duration,
          memoDuration: memoDuration,
          speedup: speedup
        });
      }
      
    } else {
      console.log(`   ❌ Error: ${result.status} - ${result.data.error || result.data}`);
      results.errorCount++;
    }
    
    results.totalTests++;
  }
}

/**
 * Test batch references endpoint
 */
async function testBatchReferences() {
  console.log('\n🔍 Testing batch references...');
  
  const result = await makeRequest('POST', '/references/batch', {
    vault_path: TEST_VAULT,
    terms: BATCH_TERMS,
    mode: 'stem',
    offset: 0,
    limit: 20,
    include_total: true
  });
  
  if (result.status === 200) {
    const data = result.data;
    console.log(`✅ Batch query completed in ${result.duration.toFixed(2)}ms`);
    
    for (const [term, termData] of Object.entries(data.results)) {
      console.log(`   "${term}": ${termData.items.length} items (total: ${termData.total_count})`);
      
      results.batchTerm.push({
        term: term,
        duration: result.duration,
        count: termData.items.length,
        total: termData.total_count
      });
    }
  } else {
    console.log(`❌ Batch query failed: ${result.status} - ${result.data.error || result.data}`);
    results.errorCount++;
  }
  
  results.totalTests++;
}

/**
 * Test candidates endpoint
 */
async function testCandidates() {
  console.log('\n🔍 Testing candidates endpoint...');
  
  const result = await makeRequest('GET', `/candidates?vault_path=${encodeURIComponent(TEST_VAULT)}&file_path=test.md`);
  
  if (result.status === 200) {
    const data = result.data;
    console.log(`✅ Candidates query completed in ${result.duration.toFixed(2)}ms`);
    console.log(`   Found ${data.keywords.length} candidates`);
  } else {
    console.log(`❌ Candidates query failed: ${result.status} - ${result.data.error || result.data}`);
    results.errorCount++;
  }
  
  results.totalTests++;
}

/**
 * Test metrics endpoint
 */
async function testMetrics() {
  console.log('\n🔍 Testing metrics endpoint...');
  
  const result = await makeRequest('GET', '/metrics');
  
  if (result.status === 200) {
    const data = result.data;
    console.log('✅ Metrics retrieved:');
    console.log(`   Files scanned: ${data.filesScanned}`);
    console.log(`   Cache hits: ${data.cacheHits}`);
    console.log(`   Cache misses: ${data.cacheMisses}`);
    console.log(`   Memo hits: ${data.memoHits}`);
    console.log(`   Exceptions: ${data.exceptionsCount}`);
    console.log(`   Cache size: ${data.cacheSize}`);
    console.log(`   Memory usage: ${(data.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  } else {
    console.log(`❌ Metrics query failed: ${result.status} - ${result.data.error || result.data}`);
  }
}

/**
 * Test error handling and edge cases
 */
async function testErrorHandling() {
  console.log('\n🔍 Testing error handling...');
  
  // Test missing parameters
  const missingParams = await makeRequest('GET', '/references');
  if (missingParams.status === 400) {
    console.log('✅ Missing parameters handled correctly');
  } else {
    console.log('❌ Missing parameters not handled');
  }
  
  // Test short terms (should trigger exact mode)
  const shortTerm = await makeRequest('GET', `/references?vault_path=${encodeURIComponent(TEST_VAULT)}&term=ab`);
  if (shortTerm.status === 200 && shortTerm.headers['x-search-mode'] === 'exact(auto)') {
    console.log('✅ Short terms trigger exact mode');
  } else {
    console.log('❌ Short terms not handled correctly');
  }
  
  // Test stop words
  const stopWord = await makeRequest('GET', `/references?vault_path=${encodeURIComponent(TEST_VAULT)}&term=the`);
  if (stopWord.status === 200 && stopWord.headers['x-search-mode'] === 'exact(auto)') {
    console.log('✅ Stop words trigger exact mode');
  } else {
    console.log('❌ Stop words not handled correctly');
  }
}

/**
 * Calculate and display performance statistics
 */
function displayPerformanceStats() {
  console.log('\n📊 Performance Statistics');
  console.log('========================');
  
  if (results.singleTerm.length > 0) {
    const durations = results.singleTerm.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log(`Single Term Queries:`);
    console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
    console.log(`  Min: ${minDuration.toFixed(2)}ms`);
    console.log(`  Max: ${maxDuration.toFixed(2)}ms`);
    console.log(`  P50: ${durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)].toFixed(2)}ms`);
  }
  
  if (results.memoization.length > 0) {
    const avgSpeedup = results.memoization.reduce((a, b) => a + b.speedup, 0) / results.memoization.length;
    console.log(`\nMemoization Performance:`);
    console.log(`  Average speedup: ${avgSpeedup.toFixed(1)}x`);
  }
  
  if (results.batchTerm.length > 0) {
    const batchDuration = results.batchTerm[0].duration;
    console.log(`\nBatch Queries:`);
    console.log(`  Duration: ${batchDuration.toFixed(2)}ms for ${BATCH_TERMS.length} terms`);
    console.log(`  Per-term cost: ${(batchDuration / BATCH_TERMS.length).toFixed(2)}ms`);
  }
  
  console.log(`\nError Rate: ${((results.errorCount / results.totalTests) * 100).toFixed(1)}%`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting performance tests for optimized backend server');
  console.log('========================================================');
  
  try {
    // Test server availability
    const serverRunning = await testStatus();
    if (!serverRunning) {
      console.log('❌ Server not running. Please start the backend server first.');
      process.exit(1);
    }
    
    // Register vault
    const vaultRegistered = await registerVault();
    if (!vaultRegistered) {
      console.log('❌ Could not register vault. Please check the vault path.');
      process.exit(1);
    }
    
    // Wait a moment for vault processing
    console.log('⏳ Waiting for vault processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run all tests
    await testSingleTermReferences();
    await testBatchReferences();
    await testCandidates();
    await testMetrics();
    await testErrorHandling();
    
    // Display results
    displayPerformanceStats();
    
    console.log('\n✅ All tests completed!');
    
    // Check if performance targets are met
    const avgDuration = results.singleTerm.length > 0 ? 
      results.singleTerm.reduce((a, b) => a + b.duration, 0) / results.singleTerm.length : 0;
    
    if (avgDuration <= 600) {
      console.log('🎯 Performance target met: P50 ≤ 600ms');
    } else {
      console.log('⚠️  Performance target not met: P50 > 600ms');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, makeRequest };
