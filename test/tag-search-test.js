#!/usr/bin/env node

/**
 * Simple test for tag-based search functionality
 */

import { spawn } from 'child_process';

const SERVER_CMD = 'node';
const SERVER_ARGS = ['dist/server.js'];

// Environment for testing with mock API
const TEST_ENV = {
  ...process.env,
  NEEMEE_API_BASE_URL: 'http://localhost:3001',
  NEEMEE_API_KEY: 'test-key-for-local-testing',
};

console.log('🧪 Testing tag-based search functionality...\n');

function testMCPServer(requestMessage, description) {
  return new Promise((resolve) => {
    console.log(`📤 ${description}`);
    
    const server = spawn(SERVER_CMD, SERVER_ARGS, {
      env: TEST_ENV,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    
    server.stdout.on('data', (data) => {
      response += data.toString();
    });

    server.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    server.on('close', (code) => {
      console.log(`📥 Response: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}\n`);
      resolve({ response, code });
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      resolve({ error, code: -1 });
    });

    // Send the test request
    server.stdin.write(JSON.stringify(requestMessage) + '\n');
    server.stdin.end();
  });
}

async function runTests() {
  try {
    // Test 1: Initialize the server
    await testMCPServer({
      jsonrpc: '2024-11-05',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    }, 'Initialize MCP server');

    // Test 2: List available tools (should include search_notes with tags)
    await testMCPServer({
      jsonrpc: '2024-11-05',
      id: 2,
      method: 'tools/list',
      params: {}
    }, 'List available tools (checking for tags support)');

    // Test 3: Test search_notes with tags parameter
    await testMCPServer({
      jsonrpc: '2024-11-05',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_notes',
        arguments: {
          tags: 'GenAI'
        }
      }
    }, 'Search notes with tag "GenAI"');

    // Test 4: Test search_notes with multiple tags
    await testMCPServer({
      jsonrpc: '2024-11-05',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search_notes',
        arguments: {
          tags: 'GenAI,testing'
        }
      }
    }, 'Search notes with multiple tags "GenAI,testing"');

    // Test 5: Test combined filters
    await testMCPServer({
      jsonrpc: '2024-11-05',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search_notes',
        arguments: {
          tags: 'productivity',
          domain: 'productivity.com'
        }
      }
    }, 'Search notes with tags and domain filter');

    console.log('✅ Tag search functionality test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();