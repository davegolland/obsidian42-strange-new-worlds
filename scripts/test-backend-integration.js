#!/usr/bin/env node

/**
 * Simple test script to verify backend integration
 * Run with: node scripts/test-backend-integration.js
 */

// Use built-in fetch (Node.js 18+)

const BASE_URL = 'http://localhost:8000';

async function testBackend() {
  console.log('Testing backend integration...\n');

  try {
    // Test status endpoint
    console.log('1. Testing /status endpoint...');
    const statusResponse = await fetch(`${BASE_URL}/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ Status:', status);
    } else {
      console.log('❌ Status failed:', statusResponse.status);
    }

    // Test register endpoint
    console.log('\n2. Testing /register endpoint...');
    const registerResponse = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vault_path: '/Users/dave/Documents/testvault/testvault' })
    });
    console.log('✅ Register response:', registerResponse.status);

    // Test query endpoint
    console.log('\n3. Testing /query/related endpoint...');
    const queryResponse = await fetch(`${BASE_URL}/query/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'test.md', k: 5 })
    });
    
    if (queryResponse.status === 503) {
      console.log('⚠️  Backend is warming up (503) - this is expected');
    } else if (queryResponse.ok) {
      const result = await queryResponse.json();
      console.log('✅ Query result:', result);
    } else {
      console.log('❌ Query failed:', queryResponse.status);
    }

  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('\nMake sure your backend server is running on', BASE_URL);
  }
}

testBackend();
