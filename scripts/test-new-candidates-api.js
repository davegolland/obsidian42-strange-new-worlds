#!/usr/bin/env node

/**
 * Test script for the new candidates API endpoint
 * This script tests the new keyword extraction API to ensure it's working correctly
 */

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:8000';

async function testCandidatesAPI() {
    console.log('🧪 Testing new candidates API...');
    console.log(`📍 Backend URL: ${BASE_URL}`);
    
    try {
        // Test 1: Register a vault
        console.log('\n1️⃣ Testing vault registration...');
        const registerResponse = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vault: 'test-vault',
                path: '/tmp/test-vault'
            })
        });
        
        if (registerResponse.ok) {
            console.log('✅ Vault registration successful');
        } else {
            console.log(`⚠️ Vault registration failed: ${registerResponse.status}`);
        }
        
        // Test 2: Check status
        console.log('\n2️⃣ Testing status endpoint...');
        const statusResponse = await fetch(`${BASE_URL}/status`);
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('✅ Status check successful:', status);
        } else {
            console.log(`⚠️ Status check failed: ${statusResponse.status}`);
        }
        
        // Test 3: Test candidates endpoint with a sample file
        console.log('\n3️⃣ Testing candidates endpoint...');
        const candidatesResponse = await fetch(`${BASE_URL}/candidates?vault=test-vault&path=sample.md`);
        
        if (candidatesResponse.ok) {
            const candidates = await candidatesResponse.json();
            console.log('✅ Candidates endpoint successful');
            console.log(`📊 Found ${candidates.keywords?.length || 0} keywords`);
            if (candidates.keywords && candidates.keywords.length > 0) {
                console.log('🔍 Sample keywords:');
                candidates.keywords.slice(0, 3).forEach(kw => {
                    console.log(`   - "${kw.keyword}" (${kw.spans.length} occurrences)`);
                });
            }
        } else {
            console.log(`⚠️ Candidates endpoint failed: ${candidatesResponse.status}`);
            const errorText = await candidatesResponse.text();
            console.log(`   Error: ${errorText}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure the backend server is running on', BASE_URL);
        console.log('   You can start it with: python -m uvicorn main:app --reload');
    }
}

// Run the test
testCandidatesAPI().then(() => {
    console.log('\n🎯 Test completed!');
}).catch(error => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
});
