import { Client } from "@modelcontextprotocol/sdk/client/index.js";

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

  async createNote(params: CreateNoteParams): Promise<any> {
    return await this.client.callTool({
      name: 'create_note',
      arguments: params
    });
  }

  async updateNote(params: UpdateNoteParams): Promise<any> {
    return await this.client.callTool({
      name: 'update_note',
      arguments: params
    });
  }

  async deleteNote(id: string, confirm: boolean = true): Promise<any> {
    return await this.client.callTool({
      name: 'delete_note',
      arguments: { id, confirm }
    });
  }

  async searchNotes(params: SearchNotesParams = {}): Promise<any> {
    return await this.client.callTool({
      name: 'search_notes',
      arguments: params
    });
  }

  async searchNotebooks(query?: string, limit?: number): Promise<any> {
    return await this.client.callTool({
      name: 'search_notebooks',
      arguments: { query, limit }
    });
  }

  async createNotebook(name: string, description?: string): Promise<any> {
    return await this.client.callTool({
      name: 'create_notebook',
      arguments: { name, description }
    });
  }

  async updateNotebook(id: string, name?: string, description?: string): Promise<any> {
    return await this.client.callTool({
      name: 'update_notebook',
      arguments: { id, name, description }
    });
  }

  async deleteNotebook(id: string, confirm: boolean = true): Promise<any> {
    return await this.client.callTool({
      name: 'delete_notebook',
      arguments: { id, confirm }
    });
  }
}