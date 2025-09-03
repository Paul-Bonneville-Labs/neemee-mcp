#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  InitializeRequestSchema,
  InitializedNotificationSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { NeemeeApiClient, AuthContext } from './lib/neemee-api-client.js';
import { extractDomain } from './lib/domainUtils.js';
import { 
  hasRequiredScope,
  handleDeleteNote,
  handleSearchNotes,
  handleSearchNotebooks,
  handleCreateNotebook,
  handleUpdateNotebook,
  handleDeleteNotebook
} from './server-tools.js';

// Create API client instance
const apiClient = new NeemeeApiClient();

// Server configuration
const server = new Server(
  {
    name: 'neemee-notes',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {
        subscribe: true,
        listChanged: true
      },
      tools: {},
    },
  }
);

// MCP Protocol Handlers

// Initialize handler
server.setRequestHandler(InitializeRequestSchema, async () => {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      resources: {},
      tools: {},
    },
    serverInfo: {
      name: 'neemee-notes',
      version: '1.0.0',
    },
  };
});

// Initialized notification handler
server.setNotificationHandler(InitializedNotificationSchema, async () => {
  // Initialization complete - ready for requests
});

// Helper function to authenticate via API
async function authenticateRequest(): Promise<AuthContext> {
  try {
    return await apiClient.validateAuth();
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}


// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'notes://list',
        mimeType: 'application/json',
        name: 'Notes List',
        description: 'List of user notes with pagination, search, notebook, domain, and tag filtering support',
      },
      {
        uri: 'notebooks://list',
        mimeType: 'application/json',
        name: 'Notebooks List',
        description: 'List of user notebooks with pagination and search support',
      },
      {
        uri: 'stats://overview',
        mimeType: 'application/json',
        name: 'Statistics Overview',
        description: 'Overview of note statistics and insights',
      },
      {
        uri: 'system://health',
        mimeType: 'application/json',
        name: 'System Health',
        description: 'Database connectivity and system status information',
      },
      {
        uri: 'collections://recent',
        mimeType: 'application/json',
        name: 'Recent Activity',
        description: 'Recently created and updated notes for LLM context',
      },
    ],
    resourceTemplates: [
      {
        uriTemplate: 'notebooks://{notebookId}',
        name: 'Individual Notebook',
        description: 'Access a specific notebook by ID with details and note count',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'notes://{noteId}',
        name: 'Individual Note',
        description: 'Access a specific note by ID with full content and frontmatter',
        mimeType: 'application/json',
      },
    ],
  };
});

// Resource templates handler
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: 'notes://{noteId}',
        mimeType: 'application/json',
        name: 'Individual Note',
        description: 'Access a specific note by its ID',
      },
      {
        uriTemplate: 'notebooks://{notebookId}',
        mimeType: 'application/json',
        name: 'Individual Notebook',
        description: 'Access a specific notebook by its ID',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const authContext = await authenticateRequest();

  if (!hasRequiredScope(authContext, 'read')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Read scope required.'
    );
  }

  const url = new URL(uri);
  
  try {
    // Handle different URI patterns
    const protocol = url.protocol;
    const hostname = url.hostname;
    const pathname = url.pathname;
    
    switch (protocol) {
      case 'notes:':
        if (hostname === 'list') {
          // Handle notes://list
        const searchParams = new URLSearchParams(url.search);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const search = searchParams.get('search')?.trim();
        const domain = searchParams.get('domain')?.trim();
        const startDate = searchParams.get('start_date') || undefined;
        const endDate = searchParams.get('end_date') || undefined;
        const notebookQuery = searchParams.get('notebook')?.trim();
        const tagsQuery = searchParams.get('tags')?.trim();

        const searchResult = await apiClient.searchNotes({
          query: search,
          notebook: notebookQuery,
          domain,
          startDate,
          endDate,
          tags: tagsQuery,
          limit,
          page
        });

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                notes: searchResult.notes,
                pagination: searchResult.pagination,
                filters: {
                  search,
                  domain,
                  startDate,
                  endDate,
                  notebook: notebookQuery,
                  tags: tagsQuery
                }
              }, null, 2),
            },
          ],
        };
        } else {
          // Handle individual note: notes://{noteId}
          const noteId = pathname.substring(1); // Remove leading slash
          
          if (!noteId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Note ID is required for individual note access'
            );
          }

          const note = await apiClient.getNote(noteId);

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(note, null, 2),
              },
            ],
          };
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource path for this protocol`
        );

      case 'notebooks:':
        if (hostname === 'list') {
        const searchParams = new URLSearchParams(url.search);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const search = searchParams.get('search')?.trim();

        const searchResult = await apiClient.searchNotebooks({
          query: search,
          limit,
          page
        });

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                notebooks: searchResult.notebooks,
                pagination: searchResult.pagination,
                filters: {
                  search
                }
              }, null, 2),
            },
          ],
        };
        } else {
          // Handle individual notebook: notebooks://{notebookId}
          const notebookId = pathname.substring(1); // Remove leading slash
          
          if (!notebookId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Notebook ID is required for individual notebook access'
            );
          }

          const notebook = await apiClient.getNotebook(notebookId);

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(notebook, null, 2),
              },
            ],
          };
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource path for this protocol`
        );

      case 'stats:':
        if (hostname === 'overview') {
        const stats = await apiClient.getStats();

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource path for this protocol`
        );

      case 'system:':
        if (hostname === 'health') {
        try {
          const healthData = await apiClient.healthCheck();

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(healthData, null, 2),
              },
            ],
          };
        } catch (error) {
          const healthData = {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'disconnected',
              error: error instanceof Error ? error.message : 'Unknown error'
            },
            mcp_server: {
              version: '1.0.0',
              capabilities: ['resources', 'tools']
            }
          };

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(healthData, null, 2),
              },
            ],
          };
        }
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource path for this protocol`
        );

      case 'collections:':
        if (hostname === 'recent') {
        const recentActivity = await apiClient.getRecentActivity();

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(recentActivity, null, 2),
            },
          ],
        };
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource path for this protocol`
        );

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown resource: ${uri}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    console.error('Error reading resource:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read resource: ${uri}`
    );
  }
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_note',
        description: 'Create a new note with content and frontmatter',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The note content in markdown format',
            },
            title: {
              type: 'string',
              description: 'Optional title for the note',
            },
            url: {
              type: 'string',
              description: 'Optional source URL for the note',
            },
            notebook: {
              type: 'string',
              description: 'Optional notebook name, partial name, or ID to assign the note to',
            },
            frontmatter: {
              type: 'object',
              description: 'Optional frontmatter fields as key-value pairs',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'update_note',
        description: 'Update an existing note',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the note to update',
            },
            content: {
              type: 'string',
              description: 'Updated note content',
            },
            title: {
              type: 'string',
              description: 'Updated note title',
            },
            frontmatter: {
              type: 'object',
              description: 'Updated frontmatter fields',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_note',
        description: 'Delete a note by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the note to delete',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation that the note should be deleted',
            },
          },
          required: ['id', 'confirm'],
        },
      },
      {
        name: 'search_notes',
        description: 'Search notes with advanced filters including notebook, domain, and tag filtering. Empty query lists all notes.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against note content and titles. Leave empty to list all notes.',
            },
            notebook: {
              type: 'string',
              description: 'Filter by notebook name, partial name, or ID',
            },
            domain: {
              type: 'string',
              description: 'Filter by source domain',
            },
            startDate: {
              type: 'string',
              description: 'Filter notes created after this date (ISO string)',
            },
            endDate: {
              type: 'string',
              description: 'Filter notes created before this date (ISO string)',
            },
            tags: {
              type: 'string',
              description: 'Filter by tags. Use comma-separated values for multiple tags (e.g. "GenAI,productivity")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
            },
          },
          required: [],
        },
      },
      {
        name: 'search_notebooks',
        description: 'Search notebooks by name and description. Empty query lists all notebooks.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against notebook name and description. Leave empty to list all notebooks.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
            },
          },
          required: [],
        },
      },
      {
        name: 'create_notebook',
        description: 'Create a new notebook for organizing notes',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the notebook',
            },
            description: {
              type: 'string',
              description: 'Optional description for the notebook',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_notebook',
        description: 'Update an existing notebook',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the notebook to update',
            },
            name: {
              type: 'string',
              description: 'Updated notebook name',
            },
            description: {
              type: 'string',
              description: 'Updated notebook description',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_notebook',
        description: 'Delete a notebook by ID (notes will be unassigned, not deleted)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the notebook to delete',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation that the notebook should be deleted',
            },
          },
          required: ['id', 'confirm'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const authContext = await authenticateRequest();

  try {
    switch (name) {
      case 'create_note': {
        if (!hasRequiredScope(authContext, 'write')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Write scope required.'
          );
        }

        const { content, title, url, notebook, frontmatter } = args as {
          content: string;
          title?: string;
          url?: string;
          notebook?: string;
          frontmatter?: Record<string, unknown>;
        };

        if (!content?.trim()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Content is required'
          );
        }

        try {
          const note = await apiClient.createNote({
            content: content.trim(),
            title: title?.trim(),
            url,
            notebook: notebook?.trim(),
            frontmatter
          });

          const notebookInfo = note.notebook ? ` in notebook "${note.notebook.name}"` : '';
          return {
            content: [
              {
                type: 'text',
                text: `Successfully created note "${note.noteTitle}" with ID: ${note.id}${notebookInfo}`,
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      case 'update_note': {
        if (!hasRequiredScope(authContext, 'write')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Write scope required.'
          );
        }

        const { id, content, title, frontmatter } = args as {
          id: string;
          content?: string;
          title?: string;
          frontmatter?: Record<string, unknown>;
        };

        if (!id) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Note ID is required'
          );
        }

        if (content === undefined && title === undefined && frontmatter === undefined) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'At least one field must be provided for update'
          );
        }

        try {
          const updatedNote = await apiClient.updateNote({
            id,
            content: content?.trim(),
            title: title?.trim(),
            frontmatter
          });

          return {
            content: [
              {
                type: 'text',
                text: `Successfully updated note "${updatedNote.noteTitle}" (ID: ${updatedNote.id})`,
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to update note: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      case 'delete_note': {
        return await handleDeleteNote(apiClient, authContext, args as { id: string; confirm: boolean });
      }

      case 'search_notes': {
        return await handleSearchNotes(apiClient, authContext, args as {
          query?: string;
          notebook?: string;
          domain?: string;
          startDate?: string;
          endDate?: string;
          tags?: string;
          limit?: number;
        });
      }

      case 'search_notebooks': {
        return await handleSearchNotebooks(apiClient, authContext, args as { query?: string; limit?: number });
      }

      case 'create_notebook': {
        return await handleCreateNotebook(apiClient, authContext, args as { name: string; description?: string });
      }

      case 'update_notebook': {
        return await handleUpdateNotebook(apiClient, authContext, args as { 
          id: string; 
          name?: string; 
          description?: string 
        });
      }

      case 'delete_notebook': {
        return await handleDeleteNotebook(apiClient, authContext, args as { id: string; confirm: boolean });
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to execute tool: ${name}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Keep the process alive
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});