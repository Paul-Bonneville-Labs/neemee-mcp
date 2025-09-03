#!/usr/bin/env node

/**
 * Simple validation test for tag functionality
 */

import { NeemeeApiClient } from '../dist/lib/neemee-api-client.js';

console.log('🏷️  Validating Tag Search Functionality');
console.log('======================================');

// Set up test environment
process.env.NEEMEE_API_KEY = 'test-key-for-local-testing';
process.env.NEEMEE_API_BASE_URL = 'http://localhost:3001';

async function validateTagFunctionality() {
  try {
    const apiClient = new NeemeeApiClient();
    
    console.log('✅ API Client created successfully');
    
    // Test 1: Authentication
    console.log('🔐 Testing authentication...');
    const authContext = await apiClient.validateAuth();
    console.log('✅ Authentication successful:', authContext);
    
    // Test 2: Search without tags
    console.log('🔍 Testing search without tags...');
    const allNotes = await apiClient.searchNotes({ limit: 5 });
    console.log(`✅ Found ${allNotes.notes.length} notes total`);
    
    // Test 3: Search with single tag
    console.log('🏷️  Testing search with single tag (GenAI)...');
    const genaiNotes = await apiClient.searchNotes({ tags: 'GenAI', limit: 5 });
    console.log(`✅ Search with GenAI tag returned ${genaiNotes.notes.length} notes`);
    
    // Display tags from returned notes
    genaiNotes.notes.forEach((note, index) => {
      const tags = note.frontmatter?.tags || [];
      console.log(`   ${index + 1}. "${note.noteTitle}" - Tags: [${tags.join(', ')}]`);
    });
    
    // Test 4: Search with multiple tags
    console.log('🏷️  Testing search with multiple tags (GenAI,testing)...');
    const multiTagNotes = await apiClient.searchNotes({ tags: ['GenAI', 'testing'], limit: 5 });
    console.log(`✅ Search with multiple tags returned ${multiTagNotes.notes.length} notes`);
    
    // Test 5: Search with combined filters
    console.log('🏷️  Testing search with tags + domain filter...');
    const combinedSearch = await apiClient.searchNotes({ 
      tags: 'GenAI', 
      domain: 'example.com',
      limit: 5 
    });
    console.log(`✅ Combined search returned ${combinedSearch.notes.length} notes`);
    
    console.log('\n🎉 All tag functionality validation tests passed!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

validateTagFunctionality();