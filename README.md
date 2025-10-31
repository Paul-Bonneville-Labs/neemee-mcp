# Neemee MCP Client Library

A TypeScript client library for connecting to Neemee MCP servers using the official Model Context Protocol SDK.

## Overview

This library provides a convenient interface for interacting with Neemee personal knowledge management systems through the Model Context Protocol (MCP). It supports both HTTP and STDIO transport modes and includes full TypeScript support.

## Installation

```bash
npm install neemee-mcp
```

## Quick Start

### HTTP Mode (Web Applications)

```typescript
import { NeemeeClient } from 'neemee-mcp';

const client = new NeemeeClient({
  transport: 'http',
  baseUrl: 'https://neemee.app/mcp',
  apiKey: 'your-api-key'
});

await client.connect();

// Create a note
const result = await client.tools.createNote({
  content: 'My note content',
  title: 'My Note'
});

console.log(result);

await client.disconnect();
```

### STDIO Mode (Direct Process Communication)

```typescript
import { NeemeeClient } from 'neemee-mcp';

const client = new NeemeeClient({
  transport: 'stdio'
});

await client.connect();

// Use same API as HTTP mode
const notes = await client.resources.listNotes();
console.log(notes);

await client.disconnect();
```

## API Reference

### NeemeeClient

Main client class that provides access to tools and resources.

#### Constructor Options

```typescript
interface NeemeeClientOptions {
  transport: 'http' | 'stdio';
  baseUrl?: string;        // For HTTP mode
  apiKey?: string;         // For authentication
  timeout?: number;        // Request timeout in milliseconds
}
```

#### Methods

- `connect(): Promise<void>` - Connect to the server
- `disconnect(): Promise<void>` - Disconnect from the server
- `listAvailableTools(): Promise<any>` - List available MCP tools
- `listAvailableResources(): Promise<any>` - List available MCP resources

### Tools API

Access via `client.tools`:

#### Notes

```typescript
// Create a note
await client.tools.createNote({
  content: 'Note content',
  title: 'Optional title',
  url: 'Optional source URL',
  notebook: 'Optional notebook name',
  frontmatter: { /* Optional metadata */ }
});

// Update a note
await client.tools.updateNote({
  id: 'note-id',
  content: 'Updated content',
  title: 'Updated title'
});

// Delete a note
await client.tools.deleteNote('note-id', true);

// Search notes
await client.tools.searchNotes({
  query: 'search terms',
  notebook: 'notebook-name',
  domain: 'example.com',
  tags: 'tag1,tag2',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  limit: 50
});
```

#### Notebooks

```typescript
// Create a notebook
await client.tools.createNotebook('Notebook Name', 'Optional description');

// Update a notebook
await client.tools.updateNotebook('notebook-id', 'New Name', 'New description');

// Delete a notebook
await client.tools.deleteNotebook('notebook-id', true);

// Search notebooks
await client.tools.searchNotebooks('search query', 20);
```

### Resources API

Access via `client.resources`:

#### Notes

```typescript
// List notes with filtering
await client.resources.listNotes({
  page: 1,
  limit: 20,
  search: 'search terms',
  domain: 'example.com',
  notebook: 'notebook-name',
  tags: 'tag1,tag2',
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});

// Get a specific note
await client.resources.getNote('note-id');
```

#### Notebooks

```typescript
// List notebooks
await client.resources.listNotebooks({
  page: 1,
  limit: 20,
  search: 'search terms'
});

// Get a specific notebook
await client.resources.getNotebook('notebook-id');
```

#### System Information

```typescript
// Get usage statistics
await client.resources.getStats();

// Check system health
await client.resources.getHealth();

// Get recent activity
await client.resources.getRecentActivity();
```

## Error Handling

The library provides specific error types for different failure scenarios:

```typescript
import { 
  NeemeeClientError,
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  ValidationError,
  ServerError
} from 'neemee-mcp';

try {
  await client.connect();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof ConnectionError) {
    console.error('Failed to connect to server');
  } else if (error instanceof NeemeeClientError) {
    console.error('Client error:', error.message);
  }
}
```

## Migration from v1.x

### Breaking Changes

- **Minimum Node.js version**: Now requires Node.js 18.0.0+
- **Constructor options**: Format has changed (see Quick Start examples)
- **Error types**: Updated error hierarchy
- **Method signatures**: Some parameters refined for better type safety

### Migration Guide

#### Old v1.x Usage

```typescript
// v1.x (deprecated)
const client = new LegacyNeemeeClient({
  useStdio: false,
  serverUrl: 'https://api.example.com',
  apiKey: 'key'
});
```

#### New v2.x Usage

```typescript
// v2.x (recommended)
const client = new NeemeeClient({
  transport: 'http',
  baseUrl: 'https://api.example.com',
  apiKey: 'key'
});
```

#### Legacy Compatibility

For temporary compatibility, use the `LegacyNeemeeClient`:

```typescript
import { LegacyNeemeeClient } from 'neemee-mcp';

// This provides the old API while you migrate
const client = new LegacyNeemeeClient({
  useStdio: false,
  serverUrl: 'https://api.example.com',
  apiKey: 'key'
});
```

## Development

### Building from Source

```bash
git clone https://github.com/Paul-Bonneville-Labs/neemee-mcp.git
cd neemee-mcp
npm install
npm run build
```

### Running Tests

```bash
# Test client functionality
npm run test:client

# Test legacy compatibility
npm run test:legacy

# Run with mock API server
npm run test:mock-api
```

### Available Scripts

- `npm run build` - Compile TypeScript to dist/
- `npm run dev` - Run development server with hot reload
- `npm run test:client` - Test new client API
- `npm run test:legacy` - Test legacy compatibility
- `npm run test:integration` - Full integration tests

## Examples

### Complete Example with Error Handling

```typescript
import { NeemeeClient, AuthenticationError, ConnectionError } from 'neemee-mcp';

async function example() {
  const client = new NeemeeClient({
    transport: 'http',
    baseUrl: 'https://neemee.app/mcp',
    apiKey: process.env.NEEMEE_API_KEY
  });

  try {
    await client.connect();
    
    // Create a note
    const createResult = await client.tools.createNote({
      content: '# My First Note\n\nThis is some content.',
      title: 'First Note',
      frontmatter: {
        tags: ['example', 'test'],
        priority: 'high'
      }
    });
    
    console.log('Created note:', createResult);
    
    // Search for notes
    const searchResult = await client.tools.searchNotes({
      query: 'first',
      tags: 'example',
      limit: 10
    });
    
    console.log('Found notes:', searchResult);
    
    // List available resources
    const resources = await client.listAvailableResources();
    console.log('Available resources:', resources);
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed - check your API key');
    } else if (error instanceof ConnectionError) {
      console.error('Connection failed - check server URL and network');
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await client.disconnect();
  }
}

example().catch(console.error);
```

### Tag-Based Search

```typescript
// Search notes with multiple tags
const taggedNotes = await client.tools.searchNotes({
  tags: 'work,important,urgent',
  notebook: 'Projects',
  limit: 25
});

// List notes with specific tags via resources
const resourceNotes = await client.resources.listNotes({
  tags: 'research,ai',
  domain: 'arxiv.org',
  limit: 50
});
```

## Configuration

## Claude Desktop Configuration

Use this package as a local bridge for STDIO transport:

```json
{
  "mcpServers": {
    "neemee-local": {
      "command": "npx",
      "args": ["-y", "neemee-mcp", "--api-key=your-api-key-here"],
      "env": {
        "NEEMEE_API_BASE_URL": "https://neemee.app/mcp"
      }
    }
  }
}
```

**Authentication:** Uses API key authentication. Get your API key from Neemee settings. The API key can be provided via the `--api-key` flag in the `args` or as a `NEEMEE_API_KEY` environment variable.

### Environment Variables

- `NEEMEE_API_KEY` - Your Neemee API key (required for STDIO mode)
- `NEEMEE_API_BASE_URL` - Base URL for Neemee API (defaults to https://neemee.app/mcp)

### Authentication Scopes

The client supports different permission levels based on your API key:

- **read**: Access to resources and search operations
- **write**: Create and update operations (includes read)
- **admin**: Delete operations (includes write and read)

## TypeScript Support

This library is written in TypeScript and provides full type definitions:

```typescript
import type { 
  NeemeeClientOptions,
  CreateNoteParams,
  UpdateNoteParams,
  SearchNotesParams 
} from 'neemee-mcp';

const options: NeemeeClientOptions = {
  transport: 'http',
  baseUrl: 'https://api.example.com',
  apiKey: 'your-key'
};

const noteParams: CreateNoteParams = {
  content: 'Note content',
  title: 'Note title',
  frontmatter: {
    tags: ['typescript', 'example'],
    date: new Date().toISOString()
  }
};
```

## License

MIT

## Support

- GitHub Issues: [Report bugs and request features](https://github.com/Paul-Bonneville-Labs/neemee-mcp/issues)
- Documentation: [Full API documentation](https://github.com/Paul-Bonneville-Labs/neemee-mcp#readme)