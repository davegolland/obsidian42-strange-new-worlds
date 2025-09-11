#!/usr/bin/env node

/**
 * Test script for the new candidates endpoint
 * Run with: node scripts/test-candidates-endpoint.js
 */

const BASE_URL = 'http://localhost:8000';

async function testCandidatesEndpoint() {
  console.log('Testing candidates endpoint...\n');

  try {
    // Test status endpoint first
    console.log('1. Testing /status endpoint...');
    const statusResponse = await fetch(`${BASE_URL}/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ Status:', status);
    } else {
      console.log('❌ Status failed:', statusResponse.status);
    }

    // Test register endpoint with new format
    console.log('\n2. Testing /register endpoint with new format...');
    const registerResponse = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        vault: 'test-vault', 
        path: '/Users/dave/workspace/stranger-new-worlds/obsidian42-strange-new-worlds' 
      })
    });
    console.log('✅ Register response:', registerResponse.status);
    
    // Wait a moment for backend to process the vault
    console.log('\n⏳ Waiting for backend to process vault...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test candidates endpoint
    console.log('\n3. Testing /candidates endpoint...');
    const candidatesResponse = await fetch(`${BASE_URL}/candidates?vault=/Users/dave/workspace/stranger-new-worlds/obsidian42-strange-new-worlds&path=README.md`);
    
    if (candidatesResponse.status === 503) {
      console.log('⚠️  Backend is warming up (503) - this is expected');
    } else if (candidatesResponse.ok) {
      const result = await candidatesResponse.json();
      console.log('✅ Candidates result:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Candidates failed:', candidatesResponse.status);
      const errorText = await candidatesResponse.text();
      console.log('Error details:', errorText);
    }

    // Test with a different file
    console.log('\n4. Testing /candidates with different file...');
    const candidatesResponse2 = await fetch(`${BASE_URL}/candidates?vault=/Users/dave/workspace/stranger-new-worlds/obsidian42-strange-new-worlds&path=examples/implicit-links-demo.md`);
    
    if (candidatesResponse2.ok) {
      const result2 = await candidatesResponse2.json();
      console.log('✅ Candidates result 2:', JSON.stringify(result2, null, 2));
    } else {
      console.log('❌ Candidates 2 failed:', candidatesResponse2.status);
    }

  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('\nMake sure your backend server is running on', BASE_URL);
  }
}

testCandidatesEndpoint();
