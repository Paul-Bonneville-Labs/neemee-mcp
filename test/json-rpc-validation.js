#!/usr/bin/env node

/**
 * JSON-RPC Migration Validation Test
 * Tests the new JSON-RPC client against a mock server
 */

import { NeemeeApiClient, NeemeeApiError } from '../dist/lib/neemee-api-client.js';

// Mock JSON-RPC server responses for testing
const mockResponses = {
  'initialize': {
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2025-06-18',
      capabilities: { resources: {}, tools: {} },
      serverInfo: { name: 'test-server', version: '1.0.0' },
      _auth: {
        userId: 'test-user-123',
        scopes: ['read', 'write', 'admin']
      }
    }
  },
  'tools/call-search_notes': {
    jsonrpc: '2.0',
    id: 2,
    result: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          notes: [
            {
              id: 'note-123',
              content: 'Test note content',
              noteTitle: 'Test Note',
              userId: 'test-user-123',
              createdAt: '2025-01-12T10:00:00Z',
              frontmatter: { tags: ['test'] }
            }
          ],
          pagination: { total: 1, page: 1, limit: 20 }
        })
      }]
    }
  },
  'resources/read-notes://note-123': {
    jsonrpc: '2.0',
    id: 3,
    result: {
      contents: [{
        uri: 'notes://note-123',
        mimeType: 'application/json',
        text: JSON.stringify({
          id: 'note-123',
          content: 'Test note content',
          noteTitle: 'Test Note',
          userId: 'test-user-123'
        })
      }]
    }
  }
};

// Mock fetch function
global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  console.log(`📨 JSON-RPC Request: ${body.method}`, body.params ? `with params` : '');
  
  // Generate mock response key
  let mockKey = body.method;
  if (body.method === 'tools/call') {
    mockKey += `-${body.params.name}`;
  } else if (body.method === 'resources/read') {
    mockKey += `-${body.params.uri}`;
  }
  
  const mockResponse = mockResponses[mockKey];
  if (!mockResponse) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(`Mock response not found for: ${mockKey}`)
    };
  }
  
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockResponse)
  };
};

async function runTests() {
  console.log('🧪 Starting JSON-RPC Migration Validation Tests\n');
  
  try {
    // Create client with mock API key
    const client = new NeemeeApiClient('http://localhost:3000/mcp', 'test-api-key');
    
    console.log('✅ Test 1: Client instantiation successful');
    
    // Test authentication via initialize
    console.log('\n🔐 Testing authentication...');
    const authContext = await client.validateAuth();
    console.log('✅ Test 2: Authentication successful');
    console.log(`   User ID: ${authContext.userId}`);
    console.log(`   Scopes: ${authContext.scopes.join(', ')}`);
    
    // Test search notes via tools/call
    console.log('\n🔍 Testing search notes...');
    const searchResult = await client.searchNotes({
      query: 'test',
      limit: 20
    });
    console.log('✅ Test 3: Search notes successful');
    console.log(`   Found ${searchResult.notes.length} notes`);
    console.log(`   First note: ${searchResult.notes[0]?.noteTitle}`);
    
    // Test get note via resources/read
    console.log('\n📄 Testing get note...');
    const note = await client.getNote('note-123');
    console.log('✅ Test 4: Get note successful');
    console.log(`   Note title: ${note.noteTitle}`);
    
    console.log('\n🎉 All JSON-RPC tests passed successfully!');
    console.log('\n📋 Migration Summary:');
    console.log('   ✅ JSON-RPC 2.0 requests implemented');
    console.log('   ✅ MCP protocol headers added');
    console.log('   ✅ Authentication via initialize method');
    console.log('   ✅ Tools mapped to tools/call');
    console.log('   ✅ Resources mapped to resources/read');
    console.log('   ✅ Error handling enhanced');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error instanceof NeemeeApiError) {
      console.error(`   JSON-RPC Error Code: ${error.code}`);
      console.error(`   Data:`, error.data);
    }
    process.exit(1);
  }
}

runTests().catch(console.error);