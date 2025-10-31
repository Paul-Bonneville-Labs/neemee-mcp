# Testing Guide for Neemee MCP Server

This guide provides several ways to test the MCP server locally during development.

## Quick Test Options

### 1. **Manual Protocol Testing** (Basic validation)

Test the MCP protocol directly:

```bash
# Build the server
npm run build

# Test with manual JSON-RPC requests
npm run test:manual
```

This tests basic MCP protocol compliance (initialize, list resources, list tools).

### 2. **Mock API Testing** (Full functionality)

Test with a mock Neemee API:

```bash
# Terminal 1: Start mock API server
npm run test:mock-api

# Terminal 2: Start MCP server with mock API
npm run test:local
```

Then test MCP requests manually or via Claude Desktop.

### 3. **Claude Desktop Integration** (Real-world testing)

The most comprehensive test - add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "neemee-local": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "NEEMEE_API_BASE_URL": "http://localhost:3001",
        "NEEMEE_API_KEY": "test-key-for-local-testing"
      }
    }
  }
}
```

## Test Scenarios

### Basic Protocol Tests

1. **Server Initialization**
   ```bash
   echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}}}' | npm run test:local
   ```

2. **Resource Discovery**
   ```bash
   echo '{"jsonrpc": "2.0", "id": 2, "method": "resources/list", "params": {}}' | npm run test:local
   ```

3. **Tool Discovery**
   ```bash
   echo '{"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {}}' | npm run test:local
   ```

### Resource Access Tests

Test different resource URIs:

- `notes://list?page=1&limit=10`
- `notes://note-123` 
- `notebooks://list`
- `notebooks://nb-123`
- `stats://overview`
- `system://health`
- `collections://recent`

### Tool Execution Tests

Test MCP tools:

- `search_notes` with various parameters
- `search_notebooks` 
- `create_note` (requires write scope)
- `create_notebook` (requires write scope)

## Mock API Server

The mock API server (`test/mock-api-server.js`) provides:

- **Authentication**: Validates Bearer tokens
- **Mock Data**: Realistic note/notebook responses  
- **All Endpoints**: Covers all API calls the MCP server makes
- **CORS Support**: For web-based testing
- **Request Logging**: Shows all API calls made by MCP server

### Mock API Endpoints

- `GET /auth/validate` - Authentication validation
- `GET /notes` - Search/list notes  
- `GET /notebooks` - Search/list notebooks
- `GET /stats` - Usage statistics
- `GET /health` - System health check
- `GET /activity/recent` - Recent activity

## Environment Variables for Testing

```bash
# Required
NEEMEE_API_KEY=test-key-for-local-testing

# Optional (defaults to localhost:3000/mcp for development, neemee.app/mcp for production)
NEEMEE_API_BASE_URL=http://localhost:3001/mcp
```

## Debugging

### Enable Debug Logging

Add console logging to debug issues:

```typescript
// In NeemeeApiClient.makeRequest()
console.log(`🔍 API Request: ${method} ${url}`);
console.log(`📤 Request body:`, body);
```

### Common Issues

1. **Authentication Errors**
   - Check NEEMEE_API_KEY is set
   - Verify API key format in Authorization header

2. **Connection Errors**
   - Ensure mock API server is running
   - Check NEEMEE_API_BASE_URL points to correct port

3. **Protocol Errors**
   - Verify JSON-RPC 2.0 request format
   - Check method names match MCP specification

## Testing Checklist

- [ ] Server initializes without errors
- [ ] Lists resources correctly  
- [ ] Lists tools correctly
- [ ] Handles authentication properly
- [ ] Resource URIs return expected data
- [ ] Tool calls work with proper scopes
- [ ] Error handling works (invalid auth, network errors)
- [ ] Claude Desktop integration works

## Next Steps

For production testing:
1. Set up actual Neemee API endpoint
2. Use real API keys with proper scopes
3. Test with real data and edge cases
4. Add automated test suite with jest/vitest