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
// Import Prisma Client directly for MCP server to avoid logging conflicts
import { PrismaClient } from '@prisma/client';

// Create a Prisma instance specifically for MCP server without logging
const prisma = new PrismaClient({
  log: [], // Disable all logging for MCP server to prevent JSON-RPC interference
  errorFormat: 'minimal',
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://neemee_user:local_dev_password@localhost:5433/neemee'
    }
  }
});
import { extractDomain } from './lib/domainUtils.js';
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

  const authContext = await getMcpAuthContext(prisma, apiKey);
  
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
        
        const offset = (page - 1) * limit;

        // Resolve notebook query to IDs if provided
        let notebookIds: string[] | undefined;
        if (notebookQuery) {
          notebookIds = await resolveNotebook(prisma, {
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
              frontmatter: true,
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
          domain: extractDomain(note.pageUrl) || 'manual',
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
        } else {
          // Handle individual note: notes://{noteId}
          const noteId = pathname.substring(1); // Remove leading slash
          
          if (!noteId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Note ID is required for individual note access'
            );
          }

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
              frontmatter: true,
              createdAt: true,
              updatedAt: true,
              notebookId: true,
              notebook: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });

          if (!note) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Note not found: ${noteId}`
            );
          }

          const transformedNote = {
            ...note,
            domain: extractDomain(note.pageUrl) || 'manual',
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt?.toISOString() || null,
            notebook: note.notebook ? {
              id: note.notebook.id,
              name: note.notebook.name
            } : null
          };

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(transformedNote, null, 2),
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
        } else {
          // Handle individual notebook: notebooks://{notebookId}
          const notebookId = pathname.substring(1); // Remove leading slash
          
          if (!notebookId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Notebook ID is required for individual notebook access'
            );
          }

          const notebook = await prisma.notebook.findFirst({
            where: {
              id: notebookId,
              userId: authContext!.userId,
            },
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
            }
          });

          if (!notebook) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Notebook not found: ${notebookId}`
            );
          }

          const transformedNotebook = {
            ...notebook,
            noteCount: notebook._count.notes,
            createdAt: notebook.createdAt.toISOString(),
            updatedAt: notebook.updatedAt.toISOString(),
          };

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(transformedNotebook, null, 2),
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
        const [noteCount, recentNotes] = await Promise.all([
          prisma.note.count({
            where: { userId: authContext!.userId }
          }),
          prisma.note.findMany({
            where: { userId: authContext!.userId },
            select: {
              pageUrl: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          })
        ]);

        // Calculate domain statistics using computed domains
        const domainStats = recentNotes.reduce((acc, note) => {
          const domain = extractDomain(note.pageUrl) || 'manual';
          acc[domain] = (acc[domain] || 0) + 1;
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
                recentActivity: recentActivity,
                topDomains: topDomains,
                generatedAt: new Date().toISOString()
              }, null, 2),
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
          // Test database connectivity
          await prisma.$queryRaw`SELECT 1`;
          
          const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'connected',
              type: 'PostgreSQL'
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [recentNotes, recentNotebooks] = await Promise.all([
          prisma.note.findMany({
            where: {
              userId: authContext!.userId,
              OR: [
                { createdAt: { gte: thirtyDaysAgo } },
                { updatedAt: { gte: thirtyDaysAgo } }
              ]
            },
            select: {
              id: true,
              noteTitle: true,
              pageUrl: true,
              createdAt: true,
              updatedAt: true,
              notebook: {
                select: {
                  name: true
                }
              }
            },
            orderBy: [
              { updatedAt: 'desc' },
              { createdAt: 'desc' }
            ],
            take: 20
          }),
          prisma.notebook.findMany({
            where: {
              userId: authContext!.userId,
              OR: [
                { createdAt: { gte: thirtyDaysAgo } },
                { updatedAt: { gte: thirtyDaysAgo } }
              ]
            },
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  notes: true
                }
              }
            },
            orderBy: [
              { updatedAt: 'desc' },
              { createdAt: 'desc' }
            ],
            take: 10
          })
        ]);

        const recentActivity = {
          summary: {
            timeframe: 'Last 30 days',
            noteCount: recentNotes.length,
            notebookCount: recentNotebooks.length
          },
          recentNotes: recentNotes.map(note => ({
            ...note,
            domain: extractDomain(note.pageUrl) || 'manual',
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt?.toISOString() || null,
          })),
          recentNotebooks: recentNotebooks.map(notebook => ({
            ...notebook,
            noteCount: notebook._count.notes,
            createdAt: notebook.createdAt.toISOString(),
            updatedAt: notebook.updatedAt.toISOString(),
          }))
        };

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
        description: 'Search notes with advanced filters including notebook filtering. Empty query lists all notes.',
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

        // Resolve notebook if provided
        let notebookId: string | null = null;
        if (notebook?.trim()) {
          const notebookIds = await resolveNotebook(prisma, {
            userId: authContext!.userId,
            notebookQuery: notebook.trim()
          });
          
          if (notebookIds.length === 0) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `No notebook found matching "${notebook}". Please check the notebook name and try again.`
            );
          }
          
          // Use the first match if multiple notebooks found
          notebookId = notebookIds[0];
        }

        const note = await prisma.note.create({
          data: {
            userId: authContext!.userId,
            content: content.trim(),
            noteTitle: title?.trim() || 'Untitled Note',
            pageUrl: url || null,
            notebookId: notebookId,
            frontmatter: {
              ...(frontmatter || {}),
              created_via: { type: 'string', value: 'mcp' }
            } as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            noteTitle: true,
            content: true,
            createdAt: true,
            notebookId: true,
            notebook: {
              select: {
                name: true
              }
            }
          }
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

        // Verify note exists and belongs to user
        const existingNote = await prisma.note.findFirst({
          where: {
            id,
            userId: authContext!.userId,
          },
        });

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

        if (Object.keys(updateData).length === 0) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'At least one field must be provided for update'
          );
        }

        const updatedNote = await prisma.note.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            noteTitle: true,
            updatedAt: true,
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated note "${updatedNote.noteTitle}" (ID: ${updatedNote.id})`,
            },
          ],
        };
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
          query?: string;
          notebook?: string;
          domain?: string;
          startDate?: string;
          endDate?: string;
          limit?: number;
        };

        // Empty query is allowed - will list all notes

        const searchLimit = Math.min(100, Math.max(1, limit || 20));

        // Resolve notebook query to IDs if provided
        let notebookIds: string[] | undefined;
        if (notebook?.trim()) {
          notebookIds = await resolveNotebook(prisma, {
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
          search: query?.trim(),
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

        const queryDescription = query?.trim() ? `matching "${query}"` : 'found';
        const resultText = notes.length > 0
          ? `Found ${notes.length} notes ${queryDescription}${notebook ? ` in notebook(s) matching "${notebook}"` : ''}:\n\n` +
            notes.map((note, index) => 
              `${index + 1}. ${note.noteTitle} (${note.id})\n` +
              `   Domain: ${extractDomain(note.pageUrl) || 'manual'}\n` +
              `   Notebook: ${note.notebook?.name || 'None'}\n` +
              `   Created: ${note.createdAt.toISOString()}\n` +
              `   Content: ${note.content}\n`
            ).join('\n')
          : `No notes ${queryDescription}${notebook ? ` in notebook(s) matching "${notebook}"` : ''}`;

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
          query?: string;
          limit?: number;
        };

        // Empty query is allowed - will list all notebooks

        const searchLimit = Math.min(100, Math.max(1, limit || 20));

        const where = buildNotebookSearchFilters({
          userId: authContext!.userId,
          search: query?.trim()
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

        const queryDescription = query?.trim() ? `matching "${query}"` : 'found';
        const resultText = notebooks.length > 0
          ? `Found ${notebooks.length} notebooks ${queryDescription}:\n\n` +
            notebooks.map((notebook, index) => 
              `${index + 1}. ${notebook.name} (${notebook.id})\n` +
              `   Description: ${notebook.description || 'No description'}\n` +
              `   Notes: ${notebook._count.notes}\n` +
              `   Created: ${notebook.createdAt.toISOString()}\n`
            ).join('\n')
          : `No notebooks ${queryDescription}`;

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      }

      case 'create_notebook': {
        if (!hasRequiredScope(authContext, 'write')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Write scope required.'
          );
        }

        const { name, description } = args as {
          name: string;
          description?: string;
        };

        if (!name?.trim()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Notebook name is required'
          );
        }

        const notebook = await prisma.notebook.create({
          data: {
            userId: authContext!.userId,
            name: name.trim(),
            description: description?.trim() || null,
            frontmatter: { created_via: { type: 'string', value: 'mcp' } },
          },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created notebook "${notebook.name}" with ID: ${notebook.id}`,
            },
          ],
        };
      }

      case 'update_notebook': {
        if (!hasRequiredScope(authContext, 'write')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Insufficient permissions. Write scope required.'
          );
        }

        const { id, name, description } = args as {
          id: string;
          name?: string;
          description?: string;
        };

        if (!id) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Notebook ID is required'
          );
        }

        // Verify notebook exists and belongs to user
        const existingNotebook = await prisma.notebook.findFirst({
          where: {
            id,
            userId: authContext!.userId,
          },
        });

        if (!existingNotebook) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Notebook not found: ${id}`
          );
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;

        if (Object.keys(updateData).length === 0) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'At least one field must be provided for update'
          );
        }

        const updatedNotebook = await prisma.notebook.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            name: true,
            updatedAt: true,
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated notebook "${updatedNotebook.name}" (ID: ${updatedNotebook.id})`,
            },
          ],
        };
      }

      case 'delete_notebook': {
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
            'Notebook ID is required'
          );
        }

        if (!confirm) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Confirmation required to delete notebook'
          );
        }

        // Verify notebook exists and belongs to user
        const existingNotebook = await prisma.notebook.findFirst({
          where: {
            id,
            userId: authContext!.userId,
          },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                notes: true
              }
            }
          }
        });

        if (!existingNotebook) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Notebook not found: ${id}`
          );
        }

        // Notes will be automatically unassigned (notebookId set to null) due to onDelete: SetNull
        await prisma.notebook.delete({
          where: { id },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted notebook "${existingNotebook.name}" (ID: ${existingNotebook.id}). ${existingNotebook._count.notes} notes were unassigned but not deleted.`,
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