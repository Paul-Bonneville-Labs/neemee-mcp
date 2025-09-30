import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Response interfaces for better type safety
export interface Note {
  id: string;
  content: string;
  title?: string;
  url?: string;
  notebook?: string;
  frontmatter?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface CreateNoteResponse {
  note: Note;
  [key: string]: unknown;
}

export interface UpdateNoteResponse {
  note: Note;
  [key: string]: unknown;
}

export interface DeleteNoteResponse {
  success: boolean;
  id: string;
  [key: string]: unknown;
}

export interface SearchNotesResponse {
  notes: Note[];
  [key: string]: unknown;
}

export interface SearchNotebooksResponse {
  notebooks: Notebook[];
  [key: string]: unknown;
}

export interface CreateNotebookResponse {
  notebook: Notebook;
  [key: string]: unknown;
}

export interface UpdateNotebookResponse {
  notebook: Notebook;
  [key: string]: unknown;
}

export interface DeleteNotebookResponse {
  success: boolean;
  id: string;
  [key: string]: unknown;
}

export interface CreateNoteParams extends Record<string, unknown> {
  content: string;
  title?: string;
  url?: string;
  notebook?: string;
  frontmatter?: Record<string, unknown>;
}

export interface UpdateNoteParams extends Record<string, unknown> {
  id: string;
  content?: string;
  title?: string;
  frontmatter?: Record<string, unknown>;
}

export interface SearchNotesParams extends Record<string, unknown> {
  query?: string;
  notebook?: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
  tags?: string;
  limit?: number;
}

export class NeemeeTools {
  constructor(private client: Client) {}

  async createNote(params: CreateNoteParams): Promise<CreateNoteResponse> {
    return await this.client.callTool({
      name: 'create_note',
      arguments: params
    }) as unknown as CreateNoteResponse;
  }

  async updateNote(params: UpdateNoteParams): Promise<UpdateNoteResponse> {
    return await this.client.callTool({
      name: 'update_note',
      arguments: params
    }) as unknown as UpdateNoteResponse;
  }

  async deleteNote(id: string, confirm: boolean = true): Promise<DeleteNoteResponse> {
    return await this.client.callTool({
      name: 'delete_note',
      arguments: { id, confirm }
    }) as unknown as DeleteNoteResponse;
  }

  async searchNotes(params: SearchNotesParams = {}): Promise<SearchNotesResponse> {
    return await this.client.callTool({
      name: 'search_notes',
      arguments: params
    }) as unknown as SearchNotesResponse;
  }

  async searchNotebooks(query?: string, limit?: number): Promise<SearchNotebooksResponse> {
    return await this.client.callTool({
      name: 'search_notebooks',
      arguments: { query, limit }
    }) as unknown as SearchNotebooksResponse;
  }

  async createNotebook(name: string, description?: string): Promise<CreateNotebookResponse> {
    return await this.client.callTool({
      name: 'create_notebook',
      arguments: { name, description }
    }) as unknown as CreateNotebookResponse;
  }

  async updateNotebook(id: string, name?: string, description?: string): Promise<UpdateNotebookResponse> {
    return await this.client.callTool({
      name: 'update_notebook',
      arguments: { id, name, description }
    }) as unknown as UpdateNotebookResponse;
  }

  async deleteNotebook(id: string, confirm: boolean = true): Promise<DeleteNotebookResponse> {
    return await this.client.callTool({
      name: 'delete_notebook',
      arguments: { id, confirm }
    }) as unknown as DeleteNotebookResponse;
  }
}