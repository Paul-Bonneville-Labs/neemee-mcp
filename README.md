# Neemee MCP Server

A Model Context Protocol (MCP) server for the Neemee personal knowledge management system.

## Overview

This MCP server provides Claude Code and other MCP clients with access to your Neemee notes, notebooks, and collections. It supports both reading and writing operations with proper authentication and scoping.

## MCP Transport Implementation

This server implements the **Standard I/O (stdio) transport** for Model Context Protocol communication. This transport choice was made for several technical and practical reasons outlined below.

### Available MCP Transport Options

The Model Context Protocol supports multiple transport mechanisms:

1. **Standard I/O (stdio)** - Communication via stdin/stdout streams
2. **Streamable HTTP** - HTTP-based transport with optional Server-Sent Events (SSE)
3. **HTTP with SSE (deprecated)** - Legacy HTTP transport with separate SSE endpoint

### Our Transport Choice: stdio

We chose the **stdio transport** for this implementation because it offers several advantages for our use case:

#### Benefits of stdio Transport

- **Simplicity**: Direct process communication without network complexity
- **Security**: No network endpoints to secure - communication happens via process pipes
- **Client Integration**: Seamless integration with Claude Desktop and other MCP clients
- **Resource Efficiency**: No HTTP server overhead or connection management
- **Reliability**: Built-in process lifecycle management and error handling
- **Local Development**: Perfect for local development and testing workflows

#### Technical Implementation

The server uses the `StdioServerTransport` from the MCP TypeScript SDK:

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

#### Message Flow

1. **Client Process**: MCP client (Claude Desktop) spawns server as subprocess
2. **JSON-RPC Messages**: All communication uses JSON-RPC 2.0 over stdin/stdout
3. **Message Delimiting**: Each message is newline-delimited UTF-8 text
4. **Logging**: Server can write logs to stderr (captured by client)
5. **Process Lifecycle**: Client manages server process lifecycle

#### Protocol Constraints

- Messages **MUST** be valid MCP JSON-RPC messages
- Messages **MUST NOT** contain embedded newlines
- Server **MUST NOT** write non-MCP content to stdout
- Server **MAY** write logs to stderr for debugging

### Alternative Transport Considerations

While we chose stdio, here's why other transports weren't selected:

#### Streamable HTTP Transport

**Pros:**
- Supports multiple concurrent clients
- Better for web-based integrations
- Supports server-initiated notifications via SSE
- Suitable for remote deployments

**Cons:**
- Requires HTTP server setup and management
- Additional security considerations (CORS, authentication, DNS rebinding)
- More complex session management
- Network-dependent reliability

**When to Consider:** Use for multi-client deployments, web applications, or when server needs to initiate communications.

#### HTTP with SSE (Deprecated)

**Pros:**
- Legacy compatibility with older MCP clients

**Cons:**
- Deprecated in favor of Streamable HTTP
- Separate endpoints for SSE and message handling
- More complex implementation

**When to Consider:** Only for backwards compatibility with pre-2025 MCP clients.

### Client Configuration

#### Claude Desktop Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "neemee": {
      "command": "npx",
      "args": ["-y", "neemee-mcp-server"],
      "env": {
        "NEEMEE_API_BASE_URL": "https://your-neemee-instance.com/api",
        "NEEMEE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Other MCP Clients (stdio)

For custom integrations using the MCP SDK:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "neemee-mcp-server"]
});

const client = new Client({
  name: "my-client",
  version: "1.0.0"
});

await client.connect(transport);
```

### Development and Debugging

#### Testing the Server

```bash
# Run in development mode with debug output
npm run dev

# Test with mock API
npm run test:mock-api

# Manual testing
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node dist/server.js
```

#### Logging and Debugging

The server logs to stderr, which is captured by MCP clients:

```typescript
// Logs appear in Claude Desktop's MCP server logs
console.error('Debug info:', data);
```

#### Connection Troubleshooting

Common stdio transport issues:

1. **Process Spawn Errors**: Check command path and arguments
2. **JSON Parse Errors**: Ensure messages are properly formatted
3. **Protocol Errors**: Verify MCP message schema compliance
4. **Environment Issues**: Confirm API key and URL configuration

### Performance Characteristics

#### stdio Transport Performance

- **Latency**: Very low - direct process communication
- **Throughput**: High for local operations, limited by API backend
- **Memory**: Minimal transport overhead
- **CPU**: Low transport processing cost
- **Scalability**: One server instance per client connection

#### API Backend Considerations

Since this server proxies to a remote API:

- **Network Dependency**: Requires reliable connection to Neemee API
- **Rate Limiting**: Respects backend API rate limits
- **Caching**: No local caching - all data fetched per request
- **Error Propagation**: API errors properly propagated to MCP client

### Future Transport Considerations

While stdio serves our current needs well, we may consider additional transports:

- **Streamable HTTP**: For multi-client scenarios or web integration
- **WebSocket**: For real-time collaboration features
- **Custom Transports**: For specialized deployment environments

The modular MCP SDK architecture allows adding new transports without changing core server logic.

## Features

### Resources
- **Notes List** - Paginated listing of notes with search and filtering
- **Notes Search** - Advanced search across note content and metadata
- **Notebooks List** - List of notebooks with note counts
- **Collections List** - User's note collections
- **Statistics Overview** - Insights about note usage and activity

### Tools
- **create_note** - Create new notes with content and metadata
- **update_note** - Update existing notes
- **delete_note** - Delete notes (admin scope required)
- **search_notes** - Advanced search with notebook filtering
- **search_notebooks** - Search notebooks by name and description

## Installation

### Production Installation (Recommended)

Install and run from npm:

```bash
# Run directly with npx (downloads and runs latest version)
npx neemee-mcp-server

# Or install globally for frequent use
npm install -g neemee-mcp-server
neemee-mcp-server
```

### Development Installation

For local development and contributions:

```bash
# Clone the repository
git clone https://github.com/Paul-Bonneville-Labs/neemee-mcp-server.git
cd neemee-mcp-server

# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Or build and run production version
npm run build
npm start
```

### MCP Client Integration

#### Claude Desktop

The most common integration is with Claude Desktop. Add the following to your Claude Desktop configuration file:

**Location of config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Configuration:**

```json
{
  "mcpServers": {
    "neemee": {
      "command": "npx",
      "args": ["-y", "neemee-mcp-server"],
      "env": {
        "NEEMEE_API_BASE_URL": "https://your-neemee-instance.com/api",
        "NEEMEE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Alternative configurations:**

```json
{
  "mcpServers": {
    "neemee": {
      "command": "node",
      "args": ["/path/to/neemee-mcp-server/dist/server.js"],
      "env": {
        "NEEMEE_API_BASE_URL": "http://localhost:3000/api",
        "NEEMEE_API_KEY": "your-development-api-key"
      }
    }
  }
}
```

#### Claude Code (VS Code Extension)

Claude Code automatically discovers and manages MCP servers. Simply install the package globally:

```bash
npm install -g neemee-mcp-server
```

#### Upgrading

To upgrade an existing installation to the latest version:

**Check your current version:**
```bash
npm list -g --depth=0 | grep neemee-mcp-server
```

**Check the latest available version:**
```bash
npm info neemee-mcp-server version
```

**Upgrade to the latest version:**
```bash
npm install -g neemee-mcp-server@latest
```

> **Note:** After upgrading, you may need to restart Claude Code or your MCP client for the changes to take effect.

#### Custom MCP Client Integration

For developers building custom MCP clients:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({
  name: "my-neemee-client",
  version: "1.0.0"
}, {
  capabilities: {
    resources: {},
    tools: {}
  }
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "neemee-mcp-server"],
  env: {
    NEEMEE_API_BASE_URL: "https://your-neemee-instance.com/api",
    NEEMEE_API_KEY: "your-api-key-here"
  }
});

await client.connect(transport);

// Now you can use the client to interact with Neemee
const resources = await client.listResources();
const tools = await client.listTools();
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEEMEE_API_KEY` | ✅ Yes | - | Your Neemee API key for authentication |
| `NEEMEE_API_BASE_URL` | ❌ No | `http://localhost:3000/api` | Base URL for Neemee API backend |

### Authentication and Scopes

The server uses API key authentication with hierarchical scopes:

| Scope | Permissions | Operations |
|-------|-------------|------------|
| `read` | Read-only access | Resources, search operations |
| `write` | Read and write access | All read operations + create/update |
| `admin` | Full access | All write operations + delete |

**API Key Configuration:**
- Obtain API keys from your Neemee instance admin panel
- Keys are scoped at creation time - ensure appropriate permissions
- Keys should be kept secure and rotated regularly

**Permission Validation:**
- Each MCP operation checks required scope before execution
- Operations fail gracefully with clear error messages
- Scope checking happens at the API backend level

## Development

### Local Development Setup

```bash
# Clone and setup
git clone https://github.com/Paul-Bonneville-Labs/neemee-mcp-server.git
cd neemee-mcp-server
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API credentials

# Development workflow
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run start        # Run compiled version
npm run lint         # Check code style
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run development server with tsx hot reload |
| `npm run build` | Compile TypeScript to `dist/` directory |
| `npm run start` | Start production server from compiled code |
| `npm run prepublishOnly` | Build before publishing (automatic) |
| `npm run test:mock-api` | Run with mock API server for testing |
| `npm run test:manual` | Manual integration testing |
| `npm run test:integration` | Full integration test suite |
| `npm run test:local` | Test with local API configuration |

### Testing the Server

#### Manual Testing via Command Line

```bash
# Build and test initialization
npm run build
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | NEEMEE_API_KEY=your-key node dist/server.js
```

#### Integration Testing

```bash
# Run mock API server in one terminal
npm run test:mock-api

# Run integration tests in another terminal
NEEMEE_API_BASE_URL=http://localhost:3001 NEEMEE_API_KEY=test-key npm run test:integration
```

#### Claude Desktop Testing

1. Add server to Claude Desktop configuration
2. Restart Claude Desktop
3. Check MCP server logs for connection errors
4. Test basic operations like listing resources and calling tools

### Architecture Overview

#### Key Components

- **`src/server.ts`**: Main MCP server implementation with protocol handlers
- **`src/lib/neemee-api-client.ts`**: HTTP client for Neemee API communication
- **`src/server-tools.ts`**: Business logic for MCP tool operations
- **`src/lib/domainUtils.ts`**: URL/domain extraction utilities

#### Request Flow

```
MCP Client → stdio → Server → API Client → Neemee API
     ↑                                         ↓
Response ← stdio ← Server ← API Client ← HTTP Response
```

#### Error Handling

- API errors are caught and converted to MCP errors
- Network failures trigger appropriate MCP error responses
- Authentication failures provide clear error messages
- Validation errors include specific field information

### Contributing

#### Code Style

- Follow TypeScript strict mode
- Use ESLint configuration provided
- Write descriptive commit messages
- Add JSDoc comments for public APIs

#### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run lint` and fix any issues
5. Submit a pull request with description

#### Debugging Tips

- Use `console.error()` for logging (appears in Claude Desktop logs)
- Set `DEBUG=1` environment variable for verbose output
- Check network connectivity to Neemee API
- Verify API key permissions and scopes

## API Reference

### Resources

#### Notes List
- URI: `notes://list?page=1&limit=20&search=query&notebook=name`
- Lists notes with pagination and filtering

#### Notes Search  
- URI: `notes://search?query=search_term&notebook=name&limit=20`
- Advanced search across note content

#### Individual Note
- URI: `notes://[note-id]`
- Get specific note by ID

#### Notebooks List
- URI: `notebooks://list?page=1&limit=20&search=query`
- Lists notebooks with search support

#### Collections List
- URI: `collections://list`
- Lists all user collections

#### Statistics
- URI: `stats://overview`
- Overview of note statistics and insights

## License

MIT