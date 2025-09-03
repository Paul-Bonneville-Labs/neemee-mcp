#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'dist', 'server.js');

console.log('🏷️  Testing Neemee MCP Server Tag Functionality');
console.log('===============================================');

// Test environment
process.env.NEEMEE_API_KEY = 'test-key-for-local-testing';
process.env.NEEMEE_API_BASE_URL = 'http://localhost:3001';

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseCount = 0;
const maxTests = 6;

// Handle server output
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('📨 Server Response:', JSON.stringify(response, null, 2));
        responseCount++;
        
        // Log specific details for search responses
        if (response.result && response.result.content) {
          const content = response.result.content[0];
          if (content.type === 'text' && content.text.includes('Found')) {
            console.log('🔍 Search Result Summary:', content.text.split('\\n')[0]);
          }
        }
        
      } catch (e) {
        console.log('📨 Raw Response:', line);
      }
    }
  });
  
  if (responseCount >= maxTests) {
    server.kill();
    console.log('✅ Tag functionality test completed');
    process.exit(0);
  }
});

server.stderr.on('data', (data) => {
  console.error('❌ Server Error:', data.toString());
});

// Tag-specific test sequence
const tests = [
  {
    name: 'Initialize Server',
    request: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "tag-test-client",
          version: "1.0.0"
        }
      }
    }
  },
  {
    name: 'List Tools (Check for tags support)',
    request: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    }
  },
  {
    name: 'Search Notes with Single Tag (GenAI)',
    request: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "search_notes",
        arguments: {
          tags: "GenAI"
        }
      }
    }
  },
  {
    name: 'Search Notes with Multiple Tags (productivity,work)',
    request: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "search_notes",
        arguments: {
          tags: "productivity,work"
        }
      }
    }
  },
  {
    name: 'Search Notes with Combined Filters (tags + domain)',
    request: {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "search_notes",
        arguments: {
          tags: "GenAI",
          domain: "example.com"
        }
      }
    }
  },
  {
    name: 'Read Notes Resource with Tags Parameter',
    request: {
      jsonrpc: "2.0",
      id: 6,
      method: "resources/read",
      params: {
        uri: "notes://list?tags=testing&limit=5"
      }
    }
  }
];

// Send test requests with delays
tests.forEach((test, index) => {
  setTimeout(() => {
    console.log(`🔍 Testing: ${test.name}`);
    server.stdin.write(JSON.stringify(test.request) + '\n');
  }, index * 2000); // 2 second delays
});

// Cleanup
setTimeout(() => {
  server.kill();
  console.log('⏰ Test timeout - server killed');
  process.exit(1);
}, 20000);