// Tool handlers refactored to use API client
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { NeemeeApiClient, AuthContext } from './lib/neemee-api-client.js';

export function hasRequiredScope(authContext: AuthContext, requiredScope: string): boolean {
  return authContext.scopes.includes(requiredScope) || authContext.scopes.includes('admin');
}

export async function handleDeleteNote(
  apiClient: NeemeeApiClient,
  authContext: AuthContext,
  args: { id: string; confirm: boolean }
) {
  if (!hasRequiredScope(authContext, 'admin')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Admin scope required.'
    );
  }

  const { id, confirm } = args;

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

  try {
    const deletedNote = await apiClient.deleteNote(id);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted note "${deletedNote.noteTitle}" (ID: ${deletedNote.id})`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function handleSearchNotes(
  apiClient: NeemeeApiClient,
  authContext: AuthContext,
  args: {
    query?: string;
    notebook?: string;
    domain?: string;
    startDate?: string;
    endDate?: string;
    tags?: string;
    limit?: number;
  }
) {
  if (!hasRequiredScope(authContext, 'read')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Read scope required.'
    );
  }

  const { query, notebook, domain, startDate, endDate, tags, limit } = args;
  const searchLimit = Math.min(100, Math.max(1, limit || 20));

  try {
    const result = await apiClient.searchNotes({
      query: query?.trim(),
      notebook: notebook?.trim(),
      domain,
      startDate,
      endDate,
      tags: tags?.trim(),
      limit: searchLimit
    });

    const queryDescription = query?.trim() ? `matching "${query}"` : 'found';
    const filtersDescription = [
      notebook ? `notebook(s) matching "${notebook}"` : null,
      domain ? `domain "${domain}"` : null,
      tags ? `tag(s) "${tags}"` : null
    ].filter(Boolean).join(', ');
    
    const resultText = result.notes.length > 0
      ? `Found ${result.notes.length} notes ${queryDescription}${filtersDescription ? ` with filters: ${filtersDescription}` : ''}:\n\n` +
        result.notes.map((note, index) => {
          const noteTags = note.frontmatter?.tags as string[] || [];
          return `${index + 1}. ${note.noteTitle} (${note.id})\n` +
            `   Domain: ${note.domain || 'manual'}\n` +
            `   Notebook: ${note.notebook?.name || 'None'}\n` +
            `   Tags: ${noteTags.length > 0 ? noteTags.join(', ') : 'None'}\n` +
            `   Created: ${note.createdAt}\n` +
            `   Content: ${note.content}\n`;
        }).join('\n')
      : `No notes ${queryDescription}${filtersDescription ? ` with filters: ${filtersDescription}` : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search notes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function handleSearchNotebooks(
  apiClient: NeemeeApiClient,
  authContext: AuthContext,
  args: { query?: string; limit?: number }
) {
  if (!hasRequiredScope(authContext, 'read')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Read scope required.'
    );
  }

  const { query, limit } = args;
  const searchLimit = Math.min(100, Math.max(1, limit || 20));

  try {
    const result = await apiClient.searchNotebooks({
      query: query?.trim(),
      limit: searchLimit
    });

    const queryDescription = query?.trim() ? `matching "${query}"` : 'found';
    const resultText = result.notebooks.length > 0
      ? `Found ${result.notebooks.length} notebooks ${queryDescription}:\n\n` +
        result.notebooks.map((notebook, index) => 
          `${index + 1}. ${notebook.name} (${notebook.id})\n` +
          `   Description: ${notebook.description || 'No description'}\n` +
          `   Notes: ${notebook.noteCount || notebook._count?.notes || 0}\n` +
          `   Created: ${notebook.createdAt}\n`
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
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search notebooks: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function handleCreateNotebook(
  apiClient: NeemeeApiClient,
  authContext: AuthContext,
  args: { name: string; description?: string }
) {
  if (!hasRequiredScope(authContext, 'write')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Write scope required.'
    );
  }

  const { name, description } = args;

  if (!name?.trim()) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Notebook name is required'
    );
  }

  try {
    const notebook = await apiClient.createNotebook({
      name: name.trim(),
      description: description?.trim()
    });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully created notebook "${notebook.name}" with ID: ${notebook.id}`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create notebook: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function handleUpdateNotebook(
  apiClient: NeemeeApiClient,
  authContext: AuthContext,
  args: { id: string; name?: string; description?: string }
) {
  if (!hasRequiredScope(authContext, 'write')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Write scope required.'
    );
  }

  const { id, name, description } = args;

  if (!id) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Notebook ID is required'
    );
  }

  if (name === undefined && description === undefined) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'At least one field must be provided for update'
    );
  }

  try {
    const updatedNotebook = await apiClient.updateNotebook({
      id,
      name: name?.trim(),
      description: description?.trim()
    });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated notebook "${updatedNotebook.name}" (ID: ${updatedNotebook.id})`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to update notebook: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function handleDeleteNotebook(
  apiClient: NeemeeApiClient,
  authContext: AuthContext,
  args: { id: string; confirm: boolean }
) {
  if (!hasRequiredScope(authContext, 'admin')) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Insufficient permissions. Admin scope required.'
    );
  }

  const { id, confirm } = args;

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

  try {
    const deletedNotebook = await apiClient.deleteNotebook(id);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted notebook "${deletedNotebook.name}" (ID: ${deletedNotebook.id}). ${deletedNotebook.noteCount} notes were unassigned but not deleted.`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to delete notebook: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}