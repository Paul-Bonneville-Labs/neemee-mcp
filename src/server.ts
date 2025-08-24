#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  InitializeRequestSchema,
  InitializedNotificationSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { prisma } from './lib/prisma.js';
import { Prisma } from '@prisma/client';
import { getMcpAuthContext, hasRequiredScope, buildNoteSearchFilters, buildNotebookSearchFilters, resolveNotebook } from './lib/mcp-auth.js';

// Server configuration
const server = new Server(
  {
    name: 'neemee-notes',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// MCP Protocol Handlers

// Initialize handler
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('DEBUG: Received initialize request');
  console.error('DEBUG: Request params:', JSON.stringify(request.params));
  const response = {
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
  console.error('DEBUG: Sending initialize response:', JSON.stringify(response));
  return response;
});

// Initialized notification handler
server.setNotificationHandler(InitializedNotificationSchema, async () => {
  console.error('DEBUG: Received initialized notification');
});

// Helper function to authenticate API key from environment or stdin
async function authenticateRequest(): Promise<{
  userId: string;
  authType: 'api-key';
  scopes: string[];
}> {
  const apiKey = process.env.NEEMEE_API_KEY;
  
  if (!apiKey) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'API key required. Set NEEMEE_API_KEY environment variable.'
    );
  }

  const authContext = await getMcpAuthContext(apiKey);
  
  if (!authContext) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Invalid API key'
    );
  }

  return {
    userId: authContext.userId,
    authType: 'api-key' as const,
    scopes: authContext.scopes,
  };
}

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'notes://list',
        mimeType: 'application/json',
        name: 'Notes List',
        description: 'List of user notes with pagination, search, and notebook filtering support',
      },
      {
        uri: 'notes://search',
        mimeType: 'application/json',
        name: 'Notes Search',
        description: 'Advanced search across note content and metadata with notebook filtering',
      },
      {
        uri: 'notebooks://list',
        mimeType: 'application/json',
        name: 'Notebooks List',
        description: 'List of user notebooks with search support',
      },
      {
        uri: 'collections://list',
        mimeType: 'application/json',
        name: 'Collections List',
        description: 'List of user note collections',
      },
      {
        uri: 'stats://overview',
        mimeType: 'application/json',
        name: 'Statistics Overview',
        description: 'Overview of note statistics and insights',
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
    switch (url.protocol + '//' + url.hostname) {
      case 'notes://list': {
        const searchParams = new URLSearchParams(url.search);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const search = searchParams.get('search')?.trim();
        const domain = searchParams.get('domain')?.trim();
        const startDate = searchParams.get('start_date') || undefined;
        const endDate = searchParams.get('end_date') || undefined;
        const notebookQuery = searchParams.get('notebook')?.trim();
        
        const offset = (page - 1) * limit;

        // Resolve notebook query to IDs if provided
        let notebookIds: string[] | undefined;
        if (notebookQuery) {
          notebookIds = await resolveNotebook({
            userId: authContext!.userId,
            notebookQuery
          });
        }

        const where = buildNoteSearchFilters({
          userId: authContext!.userId,
          search,
          domain,
          startDate,
          endDate,
          notebookIds
        });

        const [notes, totalCount] = await Promise.all([
          prisma.note.findMany({
            where,
            select: {
              id: true,
              userId: true,
              content: true,
              pageUrl: true,
              noteTitle: true,
              metadata: true,
              frontmatter: true,
              domain: true,
              createdAt: true,
              updatedAt: true,
              notebookId: true,
              notebook: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
          }),
          prisma.note.count({ where })
        ]);

        const transformedNotes = notes.map(note => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt?.toISOString() || null,
          notebook: note.notebook ? {
            id: note.notebook.id,
            name: note.notebook.name
          } : null
        }));

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                notes: transformedNotes,
                pagination: {
                  total: totalCount,
                  page,
                  limit
                },
                filters: {
                  search,
                  domain,
                  startDate,
                  endDate,
                  notebook: notebookQuery
                }
              }, null, 2),
            },
          ],
        };
      }

      case 'notes://search': {
        const searchParams = new URLSearchParams(url.search);
        const query = searchParams.get('query')?.trim();
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const notebookQuery = searchParams.get('notebook')?.trim();

        if (!query) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Search query is required'
          );
        }

        // Resolve notebook query to IDs if provided
        let notebookIds: string[] | undefined;
        if (notebookQuery) {
          notebookIds = await resolveNotebook({
            userId: authContext!.userId,
            notebookQuery
          });
        }

        const where = buildNoteSearchFilters({
          userId: authContext!.userId,
          search: query,
          notebookIds
        });

        const notes = await prisma.note.findMany({
          where,
          select: {
            id: true,
            userId: true,
            content: true,
            pageUrl: true,
            noteTitle: true,
            metadata: true,
            frontmatter: true,
            domain: true,
            createdAt: true,
            updatedAt: true,
            notebookId: true,
            notebook: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        });

        const transformedNotes = notes.map(note => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt?.toISOString() || null,
          notebook: note.notebook ? {
            id: note.notebook.id,
            name: note.notebook.name
          } : null
        }));

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                query,
                notes: transformedNotes,
                total: notes.length,
                filters: {
                  notebook: notebookQuery
                }
              }, null, 2),
            },
          ],
        };
      }

      case 'notebooks://list': {
        const searchParams = new URLSearchParams(url.search);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const search = searchParams.get('search')?.trim();
        
        const offset = (page - 1) * limit;

        const where = buildNotebookSearchFilters({
          userId: authContext!.userId,
          search
        });

        const [notebooks, totalCount] = await Promise.all([
          prisma.notebook.findMany({
            where,
            select: {
              id: true,
              name: true,
              description: true,
              userId: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  notes: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
          }),
          prisma.notebook.count({ where })
        ]);

        const transformedNotebooks = notebooks.map(notebook => ({
          ...notebook,
          noteCount: notebook._count.notes,
          createdAt: notebook.createdAt.toISOString(),
          updatedAt: notebook.updatedAt.toISOString(),
        }));

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                notebooks: transformedNotebooks,
                pagination: {
                  total: totalCount,
                  page,
                  limit
                },
                filters: {
                  search
                }
              }, null, 2),
            },
          ],
        };
      }

      case 'collections://list': {
        const collections = await prisma.collection.findMany({
          where: {
            userId: authContext!.userId,
          },
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            color: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                notes: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        const transformedCollections = collections.map(collection => ({
          ...collection,
          noteCount: collection._count.notes,
          createdAt: collection.createdAt.toISOString(),
          updatedAt: collection.updatedAt?.toISOString() || null,
        }));

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                collections: transformedCollections
              }, null, 2),
            },
          ],
        };
      }

      case 'stats://overview': {
        const [noteCount, collectionCount, recentNotes] = await Promise.all([
          prisma.note.count({
            where: { userId: authContext!.userId }
          }),
          prisma.collection.count({
            where: { userId: authContext!.userId }
          }),
          prisma.note.findMany({
            where: { userId: authContext!.userId },
            select: {
              domain: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          })
        ]);

        // Calculate domain statistics
        const domainStats = recentNotes.reduce((acc, note) => {
          acc[note.domain] = (acc[note.domain] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topDomains = Object.entries(domainStats)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([domain, count]) => ({ domain, count }));

        // Calculate recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentActivity = recentNotes.filter(
          note => note.createdAt > sevenDaysAgo
        ).length;

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                totalNotes: noteCount,
                totalCollections: collectionCount,
                recentActivity: recentActivity,
                topDomains: topDomains,
                generatedAt: new Date().toISOString()
              }, null, 2),
            },
          ],
        };
      }

      default:
        // Try to handle individual note access: notes://[id]
        if (url.hostname && url.protocol === 'notes:') {
          const noteId = url.hostname;
          
          const note = await prisma.note.findFirst({
            where: {
              id: noteId,
              userId: authContext!.userId,
            },
            select: {
              id: true,
              userId: true,
              content: true,
              pageUrl: true,
              noteTitle: true,
              metadata: true,
              frontmatter: true,
              domain: true,
              createdAt: true,
              updatedAt: true
            }
          });

          if (!note) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Note not found: ${noteId}`
            );
          }

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  ...note,
                  createdAt: note.createdAt.toISOString(),
                  updatedAt: note.updatedAt?.toISOString() || null,
                }, null, 2),
              },
            ],
          };
        }

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
        description: 'Create a new note with content and metadata',
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
            frontmatter: {
              type: 'object',
              description: 'Optional frontmatter metadata as key-value pairs',
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
              description: 'Updated frontmatter metadata',
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
        description: 'Search notes with advanced filters including notebook filtering',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against note content and titles',
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
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_notebooks',
        description: 'Search notebooks by name and description',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against notebook name and description',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('DEBUG: Received tool call request');
  const { name, arguments: args } = request.params;
  console.error('DEBUG: Tool name:', name);
  console.error('DEBUG: Tool arguments:', JSON.stringify(args));
  console.error('DEBUG: Starting authentication...');
  const authContext = await authenticateRequest();
  console.error('DEBUG: Authentication complete');

  try {
    switch (name) {
      case 'create_note': {
        if (!hasRequiredScope(authContext, 'write')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Write scope required.'
          );
        }

        const { content, title, url, frontmatter } = args as {
          content: string;
          title?: string;
          url?: string;
          frontmatter?: Record<string, unknown>;
        };

        if (!content?.trim()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Content is required'
          );
        }

        // Extract domain from URL if provided
        let domain = 'manual';
        if (url) {
          try {
            domain = new URL(url).hostname;
          } catch {
            // Invalid URL, use default domain
          }
        }

        const note = await prisma.note.create({
          data: {
            userId: authContext!.userId,
            content: content.trim(),
            noteTitle: title?.trim() || 'Untitled Note',
            pageUrl: url || null,
            domain,
            metadata: {},
            frontmatter: frontmatter as Prisma.InputJsonValue || {},
          },
          select: {
            id: true,
            noteTitle: true,
            content: true,
            createdAt: true,
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created note "${note.noteTitle}" with ID: ${note.id}`,
            },
          ],
        };
      }

      case 'update_note': {
        console.error('DEBUG: Starting update_note');
        try {
          if (!hasRequiredScope(authContext, 'write')) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Insufficient permissions. Write scope required.'
            );
          }
          console.error('DEBUG: Permissions checked');

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
          console.error('DEBUG: Note ID validated:', id);

          // Verify note exists and belongs to user
          console.error('DEBUG: Checking if note exists...');
          const existingNote = await prisma.note.findFirst({
            where: {
              id,
              userId: authContext!.userId,
            },
          });
          console.error('DEBUG: Note exists check complete:', !!existingNote);

          if (!existingNote) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Note not found: ${id}`
            );
          }

          const updateData: Record<string, unknown> = {};
          if (content !== undefined) updateData.content = content.trim();
          if (title !== undefined) updateData.noteTitle = title.trim();
          if (frontmatter !== undefined) updateData.frontmatter = frontmatter;

          console.error('DEBUG: Update data prepared:', updateData);

          if (Object.keys(updateData).length === 0) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'At least one field must be provided for update'
            );
          }

          console.error('DEBUG: Starting database update...');
          const updatedNote = await prisma.note.update({
            where: { id },
            data: updateData,
            select: {
              id: true,
              noteTitle: true,
              updatedAt: true,
            }
          });
          console.error('DEBUG: Database update complete:', updatedNote);

          const response = {
            content: [
              {
                type: 'text',
                text: `Successfully updated note "${updatedNote.noteTitle}" (ID: ${updatedNote.id})`,
              },
            ],
          };
          console.error('DEBUG: Response prepared:', JSON.stringify(response));
          
          console.error('DEBUG: Returning response...');
          return response;
        } catch (error) {
          console.error('DEBUG: Error in update_note case:', error);
          throw error;
        }
      }

      case 'delete_note': {
        if (!hasRequiredScope(authContext, 'admin')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Admin scope required.'
          );
        }

        const { id, confirm } = args as {
          id: string;
          confirm: boolean;
        };

        if (!id) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Note ID is required'
          );
        }

        if (!confirm) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Confirmation required to delete note'
          );
        }

        // Verify note exists and belongs to user
        const existingNote = await prisma.note.findFirst({
          where: {
            id,
            userId: authContext!.userId,
          },
          select: {
            id: true,
            noteTitle: true,
          }
        });

        if (!existingNote) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Note not found: ${id}`
          );
        }

        await prisma.note.delete({
          where: { id },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted note "${existingNote.noteTitle}" (ID: ${existingNote.id})`,
            },
          ],
        };
      }

      case 'search_notes': {
        if (!hasRequiredScope(authContext, 'read')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Read scope required.'
          );
        }

        const { query, notebook, domain, startDate, endDate, limit } = args as {
          query: string;
          notebook?: string;
          domain?: string;
          startDate?: string;
          endDate?: string;
          limit?: number;
        };

        if (!query?.trim()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Search query is required'
          );
        }

        const searchLimit = Math.min(100, Math.max(1, limit || 20));

        // Resolve notebook query to IDs if provided
        let notebookIds: string[] | undefined;
        if (notebook?.trim()) {
          notebookIds = await resolveNotebook({
            userId: authContext!.userId,
            notebookQuery: notebook.trim()
          });
          
          if (notebookIds.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No notebook found matching "${notebook}". Please check the notebook name and try again.`,
                },
              ],
            };
          }
        }

        const where = buildNoteSearchFilters({
          userId: authContext!.userId,
          search: query.trim(),
          domain,
          startDate,
          endDate,
          notebookIds
        });

        const notes = await prisma.note.findMany({
          where,
          select: {
            id: true,
            noteTitle: true,
            content: true,
            pageUrl: true,
            domain: true,
            createdAt: true,
            notebook: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: searchLimit
        });

        const resultText = notes.length > 0
          ? `Found ${notes.length} notes matching "${query}"${notebook ? ` in notebook(s) matching "${notebook}"` : ''}:\n\n` +
            notes.map((note, index) => 
              `${index + 1}. ${note.noteTitle} (${note.id})\n` +
              `   Domain: ${note.domain}\n` +
              `   Notebook: ${note.notebook?.name || 'None'}\n` +
              `   Created: ${note.createdAt.toISOString()}\n` +
              `   Content preview: ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}\n`
            ).join('\n')
          : `No notes found matching "${query}"${notebook ? ` in notebook(s) matching "${notebook}"` : ''}`;

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      }

      case 'search_notebooks': {
        if (!hasRequiredScope(authContext, 'read')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Read scope required.'
          );
        }

        const { query, limit } = args as {
          query: string;
          limit?: number;
        };

        if (!query?.trim()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Search query is required'
          );
        }

        const searchLimit = Math.min(100, Math.max(1, limit || 20));

        const where = buildNotebookSearchFilters({
          userId: authContext!.userId,
          search: query.trim()
        });

        const notebooks = await prisma.notebook.findMany({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            _count: {
              select: {
                notes: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: searchLimit
        });

        const resultText = notebooks.length > 0
          ? `Found ${notebooks.length} notebooks matching "${query}":\n\n` +
            notebooks.map((notebook, index) => 
              `${index + 1}. ${notebook.name} (${notebook.id})\n` +
              `   Description: ${notebook.description || 'No description'}\n` +
              `   Notes: ${notebook._count.notes}\n` +
              `   Created: ${notebook.createdAt.toISOString()}\n`
            ).join('\n')
          : `No notebooks found matching "${query}"`;

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    console.error('DEBUG: Caught error in tool handler:', error);
    if (error instanceof McpError) {
      console.error('DEBUG: Rethrowing McpError');
      throw error;
    }
    
    console.error('Error calling tool:', error);
    console.error('DEBUG: Throwing InternalError');
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to execute tool: ${name}`
    );
  }
});

// Start the server
async function main() {
  console.error('DEBUG: Creating stdio transport...');
  const transport = new StdioServerTransport();
  
  console.error('DEBUG: Connecting server to transport...');
  await server.connect(transport);
  
  console.error('Neemee MCP server running on stdio');
  console.error('DEBUG: Server connected and ready for requests');
  
  // Keep the process alive
  process.on('SIGINT', async () => {
    console.error('DEBUG: Received SIGINT, shutting down...');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});