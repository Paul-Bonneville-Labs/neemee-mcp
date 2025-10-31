# MCP Resource Refactoring Implementation Plan

## Problem Statement

The current MCP resource implementation uses ResourceTemplate `list` functions that enumerate individual notes and notebooks on every `listResources()` call. This causes:

1. **Performance Issues**: Database queries executed on every resource inspection
2. **Scalability Problems**: Resource list grows linearly with user's note count
3. **Poor UX**: Claude Code shows dozens/hundreds of individual items in resource picker
4. **Network Overhead**: Unnecessary data transfer on every MCP client connection

### Current Behavior

When `listResources()` is called:
```json
{
  "resources": [
    { "uri": "neemee://notes/abc-123", "name": "My First Note" },
    { "uri": "neemee://notes/def-456", "name": "Another Note" },
    // ... 50+ individual notes
    { "uri": "neemee://notebooks/xyz-789", "name": "Work" },
    // ... all individual notebooks
    { "uri": "neemee://stats/overview" },
    { "uri": "neemee://collections/recent" },
    { "uri": "neemee://system/health" }
  ]
}
```

### Expected Behavior

```json
{
  "resources": [
    { "uri": "neemee://notes/list", "name": "Notes List" },
    { "uri": "neemee://notebooks/list", "name": "Notebooks List" },
    { "uri": "neemee://stats/overview", "name": "Statistics" },
    { "uri": "neemee://collections/recent", "name": "Recent Activity" },
    { "uri": "neemee://system/health", "name": "System Health" }
  ],
  "resourceTemplates": [
    { "uriTemplate": "neemee://notes/{id}", "name": "Individual Note" },
    { "uriTemplate": "neemee://notebooks/{id}", "name": "Individual Notebook" }
  ]
}
```

## Implementation Steps

### Step 1: Create New List Resources

#### 1.1 Notes List Resource (`neemee://notes/list`)

**Location**: `/src/app/mcp/lib/register-resources.ts`

**Implementation**:
```typescript
// Add BEFORE the Individual Note Resource template
server.resource(
  'Notes List',
  'neemee://notes/list',
  {
    description: 'Paginated list of all notes with search and filtering capabilities. Supports query parameters: limit, offset, query, notebook, domain, tags, dateFrom, dateTo',
    mimeType: 'application/json'
  },
  async (uri: URL, extra: { authInfo?: AuthInfo }) => {
    const authContext = extractAuthContext(extra);

    // Parse query parameters from URI
    const params = new URLSearchParams(uri.search);
    const limit = parseInt(params.get('limit') || '50', 10);
    const offset = parseInt(params.get('offset') || '0', 10);
    const query = params.get('query') || undefined;
    const notebook = params.get('notebook') || undefined;
    const domain = params.get('domain') || undefined;
    const tags = params.get('tags') || undefined;
    const dateFrom = params.get('dateFrom') || undefined;
    const dateTo = params.get('dateTo') || undefined;

    try {
      const result = await service.searchNotes({
        limit,
        offset,
        query,
        notebook,
        domain,
        tags,
        dateFrom,
        dateTo
      }, authContext);

      // Format as a readable list with metadata
      const notesList = result.items.map(note => ({
        id: note.id,
        uri: `neemee://notes/${note.id}`,
        title: note.noteTitle || 'Untitled',
        created: note.createdAt,
        updated: note.updatedAt,
        notebook: note.notebook?.name || null,
        domain: note.domain?.domain || null,
        tags: note.frontmatter?.tags || [],
        preview: note.content.substring(0, 200) + (note.content.length > 200 ? '...' : '')
      }));

      const response = {
        notes: notesList,
        pagination: result.pagination,
        filters: {
          query,
          notebook,
          domain,
          tags,
          dateFrom,
          dateTo
        }
      };

      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to list notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
```

**Features**:
- Supports all search/filter parameters via query string
- Returns structured JSON with pagination metadata
- Includes note previews and metadata
- Each note includes its individual resource URI for drill-down

#### 1.2 Notebooks List Resource (`neemee://notebooks/list`)

**Location**: Same file, add BEFORE the Individual Notebook Resource template

**Implementation**:
```typescript
server.resource(
  'Notebooks List',
  'neemee://notebooks/list',
  {
    description: 'Complete list of all notebooks with note counts and metadata',
    mimeType: 'application/json'
  },
  async (uri: URL, extra: { authInfo?: AuthInfo }) => {
    const authContext = extractAuthContext(extra);

    try {
      const notebooks = await service.listNotebooks(authContext);

      const notebooksList = notebooks.map(notebook => ({
        id: notebook.id,
        uri: `neemee://notebooks/${notebook.id}`,
        name: notebook.name,
        description: notebook.description || null,
        created: notebook.createdAt,
        updated: notebook.updatedAt,
        noteCount: notebook.noteCount || 0
      }));

      const response = {
        notebooks: notebooksList,
        total: notebooksList.length
      };

      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to list notebooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
```

### Step 2: Remove List Functions from ResourceTemplates

#### 2.1 Individual Note Resource

**Current Code** (Lines 40-103):
```typescript
server.resource(
  'Individual Note',
  new ResourceTemplate('neemee://notes/{id}', {
    list: async (extra: { authInfo?: AuthInfo }) => {
      // REMOVE THIS ENTIRE LIST FUNCTION
    }
  }),
  { ... },
  async (uri, variables, extra) => { ... }
);
```

**Updated Code**:
```typescript
server.resource(
  'Individual Note',
  new ResourceTemplate('neemee://notes/{id}'),  // No list function
  {
    description: 'Access individual note with full content and metadata. Use neemee://notes/list to browse all notes.',
    mimeType: 'text/markdown'
  },
  async (uri: URL, variables: Variables, extra: { authInfo?: AuthInfo }) => {
    // Keep existing read handler unchanged
    const authContext = extractAuthContext(extra);
    const noteId = variables.id as string;

    if (!noteId) {
      throw new Error('Note ID is required');
    }

    // ... rest of existing implementation stays the same
  }
);
```

#### 2.2 Individual Notebook Resource

**Current Code** (Lines 106-169):
```typescript
server.resource(
  'Individual Notebook',
  new ResourceTemplate('neemee://notebooks/{id}', {
    list: async (extra: { authInfo?: AuthInfo }) => {
      // REMOVE THIS ENTIRE LIST FUNCTION
    }
  }),
  { ... },
  async (uri, variables, extra) => { ... }
);
```

**Updated Code**:
```typescript
server.resource(
  'Individual Notebook',
  new ResourceTemplate('neemee://notebooks/{id}'),  // No list function
  {
    description: 'Access individual notebook with metadata and note list. Use neemee://notebooks/list to browse all notebooks.',
    mimeType: 'text/markdown'
  },
  async (uri: URL, variables: Variables, extra: { authInfo?: AuthInfo }) => {
    // Keep existing read handler unchanged
    const authContext = extractAuthContext(extra);
    const notebookId = variables.id as string;

    if (!notebookId) {
      throw new Error('Notebook ID is required');
    }

    // ... rest of existing implementation stays the same
  }
);
```

### Step 3: Update Resource Registration Order

**Recommended order** in `register-resources.ts`:

1. List resources (new):
   - `neemee://notes/list`
   - `neemee://notebooks/list`

2. Individual resource templates (modified):
   - `neemee://notes/{id}`
   - `neemee://notebooks/{id}`

3. Static resources (unchanged):
   - `neemee://stats/overview`
   - `neemee://collections/recent`
   - `neemee://system/health`

### Step 4: Testing Requirements

#### 4.1 Unit Tests

Create tests in `/src/__tests__/mcp-resources.test.ts`:

```typescript
describe('MCP Resources', () => {
  describe('listResources()', () => {
    it('should return only 7 static resources (not individual notes)', async () => {
      const response = await client.listResources();

      expect(response.resources).toHaveLength(5);
      expect(response.resources.map(r => r.uri)).toEqual([
        'neemee://notes/list',
        'neemee://notebooks/list',
        'neemee://stats/overview',
        'neemee://collections/recent',
        'neemee://system/health'
      ]);
    });

    it('should include resource templates', async () => {
      const response = await client.listResources();

      expect(response.resourceTemplates).toHaveLength(2);
      expect(response.resourceTemplates.map(t => t.uriTemplate)).toEqual([
        'neemee://notes/{id}',
        'neemee://notebooks/{id}'
      ]);
    });
  });

  describe('neemee://notes/list', () => {
    it('should return paginated notes', async () => {
      const resource = await client.readResource({
        uri: 'neemee://notes/list?limit=10&offset=0'
      });

      const data = JSON.parse(resource.contents[0].text);
      expect(data).toHaveProperty('notes');
      expect(data).toHaveProperty('pagination');
      expect(data.notes).toBeInstanceOf(Array);
      expect(data.notes.length).toBeLessThanOrEqual(10);
    });

    it('should support filtering by notebook', async () => {
      const resource = await client.readResource({
        uri: 'neemee://notes/list?notebook=work&limit=50'
      });

      const data = JSON.parse(resource.contents[0].text);
      expect(data.filters.notebook).toBe('work');
    });

    it('should support tag filtering', async () => {
      const resource = await client.readResource({
        uri: 'neemee://notes/list?tags=GenAI,productivity'
      });

      const data = JSON.parse(resource.contents[0].text);
      expect(data.filters.tags).toBe('GenAI,productivity');
    });
  });

  describe('neemee://notebooks/list', () => {
    it('should return all notebooks', async () => {
      const resource = await client.readResource({
        uri: 'neemee://notebooks/list'
      });

      const data = JSON.parse(resource.contents[0].text);
      expect(data).toHaveProperty('notebooks');
      expect(data).toHaveProperty('total');
      expect(data.notebooks).toBeInstanceOf(Array);
    });
  });

  describe('neemee://notes/{id}', () => {
    it('should still work for individual note access', async () => {
      const resource = await client.readResource({
        uri: 'neemee://notes/test-note-id'
      });

      expect(resource.contents[0].mimeType).toBe('text/markdown');
      expect(resource.contents[0].text).toContain('Note ID:');
    });
  });
});
```

#### 4.2 Integration Testing

1. **Connect via Claude Code**:
   ```bash
   # Verify resource list is minimal
   npx @modelcontextprotocol/inspector
   ```

2. **Test Performance**:
   - Measure `listResources()` response time before/after
   - Should see significant improvement (no DB queries)

3. **Test Functionality**:
   - Browse notes via `neemee://notes/list`
   - Access individual note via `neemee://notes/{id}`
   - Verify filtering works (notebook, domain, tags)
   - Test pagination

#### 4.3 Manual Testing Checklist

- [ ] `listResources()` returns exactly 5 static resources
- [ ] `listResources()` includes 2 resource templates
- [ ] `neemee://notes/list` returns paginated JSON
- [ ] `neemee://notes/list?notebook=work` filters correctly
- [ ] `neemee://notes/list?tags=GenAI` filters by tags
- [ ] `neemee://notes/{id}` still returns individual notes
- [ ] `neemee://notebooks/list` returns all notebooks
- [ ] `neemee://notebooks/{id}` still returns individual notebooks
- [ ] Claude Code resource picker shows only 5 items
- [ ] No performance degradation on individual resource access

## Migration Strategy

### Phase 1: Implementation (Breaking Change)
1. Deploy changes to staging environment
2. Test with MCP inspector
3. Update neemee-mcp bridge client if needed

### Phase 2: Client Updates
1. Update documentation for new resource URIs
2. Update any hardcoded references from `notes://{id}` to `neemee://notes/{id}` (if URI scheme changed)
3. Update examples in README

### Phase 3: Deployment
1. Deploy to production
2. Monitor error logs for issues
3. Verify performance improvements

## Expected Outcomes

### Before
- `listResources()`: 50-100+ individual resources returned
- Response time: ~200-500ms (includes DB queries)
- Resource picker: Cluttered with individual items
- Scalability: O(n) with note count

### After
- `listResources()`: Exactly 5 static resources + 2 templates
- Response time: <50ms (no DB queries)
- Resource picker: Clean, predictable list
- Scalability: O(1), independent of note count

## Risks and Mitigation

### Risk 1: Breaking Changes for Existing Clients
**Mitigation**:
- Check if any clients are relying on list enumeration
- The bridge client (neemee-mcp) already uses parameterized URIs correctly
- No changes needed to bridge client

### Risk 2: Loss of Discoverability
**Concern**: Users might not know individual note IDs to access them
**Mitigation**:
- The `neemee://notes/list` resource provides all note IDs
- Each note in the list includes its individual resource URI
- Users browse via list, then drill down to specific notes

### Risk 3: Performance of List Resources
**Concern**: List resources might still be slow with many notes
**Mitigation**:
- List resources use pagination (limit/offset)
- Default to reasonable limits (50 notes)
- Same performance characteristics as existing tools

## Files to Modify

1. **Primary Changes**:
   - `/src/app/mcp/lib/register-resources.ts` - Main implementation

2. **Testing**:
   - `/src/__tests__/mcp-resources.test.ts` - Add new tests
   - `/src/__tests__/mcp-scope-enforcement.test.ts` - Update if needed

3. **Documentation**:
   - Update any README or docs referencing resource URIs
   - Update MCP integration examples

## Success Criteria

- [ ] `listResources()` returns ≤7 total items (5 resources + 2 templates)
- [ ] No database queries during `listResources()` call
- [ ] All existing functionality preserved
- [ ] Tests pass
- [ ] Performance improved (benchmark before/after)
- [ ] Claude Code integration works smoothly

## Timeline Estimate

- Implementation: 2-3 hours
- Testing: 1-2 hours
- Documentation: 1 hour
- **Total**: 4-6 hours

## References

- MCP Protocol Specification: https://modelcontextprotocol.io/docs/concepts/resources
- ResourceTemplate API: `@modelcontextprotocol/sdk/server/mcp.js`
- Existing Implementation: `/src/app/mcp/lib/register-resources.ts`
