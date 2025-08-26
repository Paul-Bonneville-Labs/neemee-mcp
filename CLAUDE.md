# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
- `npm run build` - Build TypeScript to dist/ directory
- `npm run dev` - Run development server with tsx (hot reload)
- `npm start` - Start production server from dist/
- `npm run prepublishOnly` - Build before publishing (runs automatically)

### Package Management
- `npm install` - Install all dependencies
- `npx @paul-bonneville-labs/neemee-mcp-server` - Run published version

## Architecture Overview

This is a **Model Context Protocol (MCP) server** for the Neemee personal knowledge management system. It provides Claude Code and other MCP clients with access to notes, notebooks, and collections through HTTP API calls to a Neemee backend service.

### Core Components

**Server Architecture:**
- **Main Server** (`src/server.ts`): Central MCP server implementation with resource/tool handlers
- **API Client** (`src/lib/neemee-api-client.ts`): HTTP client for communicating with Neemee API
- **Tool Handlers** (`src/server-tools.ts`): Business logic for MCP tool operations
- **Utilities** (`src/lib/domainUtils.ts`): URL/domain extraction and manipulation

**API Integration:**
- **Authentication**: API key-based authentication handled by Neemee API
- **Data Access**: All CRUD operations performed via HTTP API calls
- **Scoped Permissions**: API key scopes (`read`, `write`, `admin`) enforced by backend
- **No Direct Database Access**: Maintains proper separation of concerns

### Key Features

**Resources (Read Access):**
- `notes://list` - Paginated note listing with search/filtering
- `notes://{id}` - Individual note access
- `notebooks://list` - Notebook listing with note counts
- `notebooks://{id}` - Individual notebook details
- `stats://overview` - Usage statistics and insights
- `collections://recent` - Recently created/updated content

**Tools (Write Operations):**
- `create_note`, `update_note`, `delete_note` - Note CRUD operations
- `search_notes` - Advanced search with notebook filtering  
- `create_notebook`, `update_notebook`, `delete_notebook` - Notebook management
- `search_notebooks` - Notebook search functionality

### Authentication & Permissions

**API Key Scopes:**
- `read`: Access to resources and search operations
- `write`: Create and update operations
- `admin`: Delete operations

**Environment Variables:**
- `NEEMEE_API_KEY` (required): API key for authentication
- `NEEMEE_API_BASE_URL` (optional): Base URL for Neemee API (defaults to http://localhost:3000/api)

### API Architecture

The MCP server acts as a client to the Neemee API:
- **Stateless Design**: No local data storage or caching
- **HTTP-Based Communication**: All operations via REST API calls
- **Authentication Delegation**: API key validation handled by backend
- **Error Handling**: Proper error propagation from API to MCP client
- **Resource Mapping**: MCP resources and tools mapped to corresponding API endpoints

### Performance Considerations

- **Network Dependency**: Requires reliable connection to Neemee API
- **API Rate Limits**: Respects backend API rate limiting
- **Efficient Data Transfer**: Minimal payload sizes and selective field requests
- **Connection Reuse**: HTTP client optimized for multiple requests

## Testing & Validation

No specific test framework is configured. Use the MCP protocol directly or through Claude Desktop for integration testing.

## Deployment

This MCP server only requires:
- Node.js runtime environment
- Network access to Neemee API endpoint
- Valid API key with appropriate scopes