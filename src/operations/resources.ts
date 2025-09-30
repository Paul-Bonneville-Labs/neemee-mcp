import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Note, Notebook } from './tools.js';

// Resource response interfaces
export interface ListNotesResponse {
  notes: Note[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  [key: string]: unknown;
}

export interface GetNoteResponse {
  note: Note;
  [key: string]: unknown;
}

export interface ListNotebooksResponse {
  notebooks: Notebook[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  [key: string]: unknown;
}

export interface GetNotebookResponse {
  notebook: Notebook;
  [key: string]: unknown;
}

export interface StatsResponse {
  totalNotes: number;
  totalNotebooks: number;
  recentActivity: Array<{
    type: string;
    timestamp: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  [key: string]: unknown;
}

export interface RecentActivityResponse {
  activities: Array<{
    type: string;
    timestamp: string;
    item: Note | Notebook;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export class NeemeeResources {
  constructor(private client: Client) {}

  async listNotes(params?: {
    page?: number;
    limit?: number;
    search?: string;
    domain?: string;
    startDate?: string;
    endDate?: string;
    notebook?: string;
    tags?: string;
  }): Promise<ListNotesResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const uri = `notes://list${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return await this.client.readResource({ uri }) as unknown as ListNotesResponse;
  }

  async getNote(id: string): Promise<GetNoteResponse> {
    return await this.client.readResource({ uri: `notes://${id}` }) as unknown as GetNoteResponse;
  }

  async listNotebooks(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ListNotebooksResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const uri = `notebooks://list${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return await this.client.readResource({ uri }) as unknown as ListNotebooksResponse;
  }

  async getNotebook(id: string): Promise<GetNotebookResponse> {
    return await this.client.readResource({ uri: `notebooks://${id}` }) as unknown as GetNotebookResponse;
  }

  async getStats(): Promise<StatsResponse> {
    return await this.client.readResource({ uri: 'stats://overview' }) as unknown as StatsResponse;
  }

  async getHealth(): Promise<HealthResponse> {
    return await this.client.readResource({ uri: 'system://health' }) as unknown as HealthResponse;
  }

  async getRecentActivity(): Promise<RecentActivityResponse> {
    return await this.client.readResource({ uri: 'collections://recent' }) as unknown as RecentActivityResponse;
  }
}