#!/usr/bin/env node

import { createServer } from 'http';

const PORT = 3001; // Different port to avoid conflicts

// Mock API responses
const mockResponses = {
  'GET /auth/validate': {
    userId: 'test-user-123',
    scopes: ['read', 'write', 'admin']
  },
  'GET /notes': {
    notes: [
      {
        id: 'note-123',
        noteTitle: 'Test Note',
        content: '# Test Note\n\nThis is a test note for MCP server testing.',
        pageUrl: 'https://example.com',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        domain: 'example.com',
        notebook: { id: 'nb-123', name: 'Test Notebook' }
      }
    ],
    pagination: { total: 1, page: 1, limit: 20 }
  },
  'GET /notebooks': {
    notebooks: [
      {
        id: 'nb-123',
        name: 'Test Notebook',
        description: 'A test notebook',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        noteCount: 1
      }
    ],
    pagination: { total: 1, page: 1, limit: 20 }
  },
  'GET /stats': {
    totalNotes: 5,
    recentActivity: 2,
    topDomains: [
      { domain: 'example.com', count: 3 },
      { domain: 'test.com', count: 2 }
    ],
    generatedAt: new Date().toISOString()
  },
  'GET /health': {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: { status: 'connected', type: 'PostgreSQL' },
    mcp_server: { version: '1.0.0', capabilities: ['resources', 'tools'] }
  },
  'GET /activity/recent': {
    summary: { timeframe: 'Last 30 days', noteCount: 2, notebookCount: 1 },
    recentNotes: [],
    recentNotebooks: []
  }
};

const server = createServer((req, res) => {
  // CORS headers for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or invalid authorization header' }));
    return;
  }

  const token = authHeader.substring(7);
  if (token !== 'test-key-for-local-testing') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid API key' }));
    return;
  }

  const key = `${req.method} ${req.url.split('?')[0]}`;
  const response = mockResponses[key];

  if (response) {
    console.log(`📡 Mock API: ${req.method} ${req.url} → 200`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  } else {
    console.log(`❓ Mock API: ${req.method} ${req.url} → 404`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Mock Neemee API Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  Object.keys(mockResponses).forEach(key => {
    console.log(`  ${key}`);
  });
  console.log('\nTo test with MCP server, set:');
  console.log(`  NEEMEE_API_BASE_URL=http://localhost:${PORT}`);
  console.log('  NEEMEE_API_KEY=test-key-for-local-testing');
});