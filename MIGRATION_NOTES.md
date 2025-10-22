# Migration Notes

## v3.0.0 - Package Rename and Domain Migration (2025-10-22)

### Breaking Changes
- **Package renamed** from `neemee-mcp-server` to `neemee-mcp`
- **Default API URL** changed to `https://neemee.app/mcp` (from `https://neemee.paulbonneville.com/mcp`)
- **CLI command** changed from `neemee-mcp-server` to `neemee-mcp`

### Migration Steps

**1. Uninstall old package:**
```bash
npm uninstall -g neemee-mcp-server
```

**2. Install new package:**
```bash
npm install -g neemee-mcp
```

**3. Update Claude Desktop config:**
Update your `~/.claude.json` or Claude Desktop configuration file:
```json
{
  "mcpServers": {
    "neemee": {
      "command": "npx",
      "args": ["-y", "neemee-mcp"],
      "env": {
        "NEEMEE_API_KEY": "your-api-key",
        "NEEMEE_API_BASE_URL": "https://neemee.app/mcp"
      }
    }
  }
}
```

**4. Update imports** (if using as a library):
```typescript
// Old
import { NeemeeClient } from 'neemee-mcp-server';

// New
import { NeemeeClient } from 'neemee-mcp';
```

### No Code Changes Required
The API remains the same - only the package name and domain have changed. All functionality is preserved.

---

## JSON-RPC Migration Notes

### Overview
This document outlines the successful migration from individual REST endpoints to a unified JSON-RPC HTTP endpoint as specified in GitHub issue #8.

## Changes Implemented

### 1. Core Architecture Updates
- **Unified Endpoint**: All requests now go to a single `/mcp` endpoint
- **JSON-RPC 2.0 Compliance**: All requests follow JSON-RPC 2.0 specification
- **MCP Protocol Headers**: Added `MCP-Protocol-Version: 2025-06-18` header
- **Request ID Management**: Implemented auto-incrementing request IDs

### 2. Method Mapping

| Operation | Old REST Endpoint | New JSON-RPC Method | Parameters |
|-----------|-------------------|---------------------|------------|
| Search Notes | `GET /notes?query=...` | `tools/call` | `{name: "search_notes", arguments: {...}}` |
| Get Note | `GET /notes/{id}` | `resources/read` | `{uri: "notes://{id}"}` |
| Create Note | `POST /notes` | `tools/call` | `{name: "create_note", arguments: {...}}` |
| Update Note | `PUT /notes/{id}` | `tools/call` | `{name: "update_note", arguments: {...}}` |
| Delete Note | `DELETE /notes/{id}` | `tools/call` | `{name: "delete_note", arguments: {...}}` |
| Search Notebooks | `GET /notebooks?query=...` | `tools/call` | `{name: "search_notebooks", arguments: {...}}` |
| Get Notebook | `GET /notebooks/{id}` | `resources/read` | `{uri: "notebooks://{id}"}` |
| Create Notebook | `POST /notebooks` | `tools/call` | `{name: "create_notebook", arguments: {...}}` |
| Update Notebook | `PUT /notebooks/{id}` | `tools/call` | `{name: "update_notebook", arguments: {...}}` |
| Delete Notebook | `DELETE /notebooks/{id}` | `tools/call` | `{name: "delete_notebook", arguments: {...}}` |
| Get Stats | `GET /stats` | `resources/read` | `{uri: "stats://overview"}` |
| Recent Activity | `GET /activity/recent` | `resources/read` | `{uri: "collections://recent"}` |
| Health Check | `GET /health` | `resources/read` | `{uri: "system://health"}` |

### 3. Authentication Changes
- **Initialize Method**: Authentication now handled via JSON-RPC `initialize` method
- **Protocol Negotiation**: Client declares protocol version and capabilities
- **Session Management**: Server can provide session context in initialize response

### 4. Error Handling Enhancements
- **JSON-RPC Error Codes**: Proper mapping of standard error codes
  - `-32600`: Invalid Request
  - `-32601`: Method Not Found
  - `-32602`: Invalid Params
  - `-32603`: Internal Error
  - `-32000` to `-32099`: Server-defined errors
- **Enhanced Error Class**: `NeemeeApiError` with code and data properties
- **Structured Error Data**: Additional context in error responses

### 5. Response Processing
- **Tool Responses**: Parse content from `tools/call` responses
- **Resource Responses**: Parse content from `resources/read` responses
- **Type Safety**: Proper TypeScript typing for all responses

## Testing
- **Unit Tests**: Mock JSON-RPC server for testing all operations
- **Validation Test**: Comprehensive test suite validating all endpoints
- **Build Verification**: TypeScript compilation successful
- **Runtime Testing**: Server starts and initializes correctly

## Backward Compatibility
- **Legacy Methods Removed**: Old REST methods completely replaced
- **Interface Preservation**: Public API methods maintain same signatures
- **Error Handling**: Compatible error responses for existing error handling

## Benefits Achieved
✅ **Single source of truth** for MCP operations  
✅ **Eliminated API endpoint duplication**  
✅ **Full MCP 2025-06-18 protocol compliance**  
✅ **Consistent behavior** across transport methods  
✅ **Future-ready** for SSE streaming support  
✅ **Improved error handling** with standardized codes  
✅ **Simplified maintenance** with unified architecture  

## Migration Impact
- **Zero Breaking Changes**: Public API preserved
- **Enhanced Protocol Support**: Full MCP compliance
- **Performance**: Single endpoint reduces complexity
- **Maintainability**: Unified codebase easier to maintain

## Next Steps
1. **Deploy to Development**: Test with real MCP frontend
2. **Integration Testing**: Validate with MCP Inspector
3. **Production Deployment**: Roll out to production environment
4. **Performance Monitoring**: Monitor response times and error rates

## Files Modified
- `src/lib/neemee-api-client.ts`: Complete JSON-RPC migration
- `test/json-rpc-validation.js`: New validation test suite
- `MIGRATION_NOTES.md`: This documentation

## Validation Results
All tests pass successfully:
- ✅ JSON-RPC 2.0 requests implemented
- ✅ MCP protocol headers added  
- ✅ Authentication via initialize method
- ✅ Tools mapped to tools/call
- ✅ Resources mapped to resources/read
- ✅ Error handling enhanced