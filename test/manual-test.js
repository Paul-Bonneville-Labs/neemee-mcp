#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'dist', 'server.js');

console.log('🧪 Testing Neemee MCP Server');
console.log('==============================');

// Test environment
process.env.NEEMEE_API_KEY = 'test-key-for-local-testing';
process.env.NEEMEE_API_BASE_URL = 'http://localhost:3000/api';

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;

// Handle server output
server.stdout.on('data', (data) => {
  const response = data.toString();
  console.log('📨 Server Response:', JSON.stringify(JSON.parse(response), null, 2));
  responseCount++;
  
  if (responseCount >= 3) {
    server.kill();
    console.log('✅ Basic MCP protocol test completed');
    process.exit(0);
  }
});

server.stderr.on('data', (data) => {
  console.error('❌ Server Error:', data.toString());
});

// Test sequence
const tests = [
  {
    name: 'Initialize',
    request: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      }
    }
  },
  {
    name: 'List Resources',
    request: {
      jsonrpc: "2.0",
      id: 2,
      method: "resources/list",
      params: {}
    }
  },
  {
    name: 'List Tools',
    request: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {}
    }
  }
];

// Send test requests
tests.forEach((test, index) => {
  setTimeout(() => {
    console.log(`🔍 Testing: ${test.name}`);
    server.stdin.write(JSON.stringify(test.request) + '\n');
  }, index * 1000);
});

// Cleanup
setTimeout(() => {
  server.kill();
  console.log('⏰ Test timeout - server killed');
  process.exit(1);
}, 10000);