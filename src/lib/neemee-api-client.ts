/**
 * Neemee API Client for MCP Server
 * Replaces direct database access with HTTP API calls
 */

export interface NeemeeNote {
  id: string;
  userId: string;
  content: string;
  pageUrl: string | null;
  noteTitle: string;
  frontmatter: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string | null;
  notebookId: string | null;
  notebook?: {
    id: string;
    name: string;
  } | null;
  domain?: string;
}

export interface NeemeeNotebook {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  noteCount?: number;
  _count?: {
    notes: number;
  };
}

export interface SearchNotesParams {
  query?: string;
  notebook?: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}

export interface SearchNotebooksParams {
  query?: string;
  limit?: number;
  page?: number;
}

export interface CreateNoteParams {
  content: string;
  title?: string;
  url?: string;
  notebook?: string;
  frontmatter?: Record<string, unknown>;
}

export interface UpdateNoteParams {
  id: string;
  content?: string;
  title?: string;
  frontmatter?: Record<string, unknown>;
}

export interface CreateNotebookParams {
  name: string;
  description?: string;
}

export interface UpdateNotebookParams {
  id: string;
  name?: string;
  description?: string;
}

export interface AuthContext {
  userId: string;
  authType: 'api-key';
  scopes: string[];
}

export class NeemeeApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.NEEMEE_API_BASE_URL || 'http://localhost:3000/api';
    this.apiKey = apiKey || process.env.NEEMEE_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('NEEMEE_API_KEY is required');
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // Authentication
  async validateAuth(): Promise<AuthContext> {
    const response = await this.makeRequest<{
      userId: string;
      scopes: string[];
    }>('/auth/validate');

    return {
      userId: response.userId,
      authType: 'api-key',
      scopes: response.scopes,
    };
  }

  // Notes
  async searchNotes(params: SearchNotesParams): Promise<{
    notes: NeemeeNote[];
    pagination: {
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.set('query', params.query);
    if (params.notebook) searchParams.set('notebook', params.notebook);
    if (params.domain) searchParams.set('domain', params.domain);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.page) searchParams.set('page', params.page.toString());

    return this.makeRequest(`/notes?${searchParams.toString()}`);
  }

  async getNote(id: string): Promise<NeemeeNote> {
    return this.makeRequest(`/notes/${id}`);
  }

  async createNote(params: CreateNoteParams): Promise<{
    id: string;
    noteTitle: string;
    notebookId: string | null;
    notebook?: { name: string } | null;
  }> {
    return this.makeRequest('/notes', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateNote(params: UpdateNoteParams): Promise<{
    id: string;
    noteTitle: string;
  }> {
    const { id, ...updateData } = params;
    return this.makeRequest(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async deleteNote(id: string): Promise<{
    id: string;
    noteTitle: string;
  }> {
    return this.makeRequest(`/notes/${id}`, {
      method: 'DELETE',
    });
  }

  // Notebooks
  async searchNotebooks(params: SearchNotebooksParams): Promise<{
    notebooks: NeemeeNotebook[];
    pagination: {
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.set('query', params.query);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.page) searchParams.set('page', params.page.toString());

    return this.makeRequest(`/notebooks?${searchParams.toString()}`);
  }

  async getNotebook(id: string): Promise<NeemeeNotebook> {
    return this.makeRequest(`/notebooks/${id}`);
  }

  async createNotebook(params: CreateNotebookParams): Promise<{
    id: string;
    name: string;
    description: string | null;
  }> {
    return this.makeRequest('/notebooks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateNotebook(params: UpdateNotebookParams): Promise<{
    id: string;
    name: string;
  }> {
    const { id, ...updateData } = params;
    return this.makeRequest(`/notebooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async deleteNotebook(id: string): Promise<{
    id: string;
    name: string;
    noteCount: number;
  }> {
    return this.makeRequest(`/notebooks/${id}`, {
      method: 'DELETE',
    });
  }

  // Statistics
  async getStats(): Promise<{
    totalNotes: number;
    recentActivity: number;
    topDomains: Array<{ domain: string; count: number }>;
    generatedAt: string;
  }> {
    return this.makeRequest('/stats');
  }

  // Recent activity
  async getRecentActivity(): Promise<{
    summary: {
      timeframe: string;
      noteCount: number;
      notebookCount: number;
    };
    recentNotes: NeemeeNote[];
    recentNotebooks: NeemeeNotebook[];
  }> {
    return this.makeRequest('/activity/recent');
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    database: {
      status: string;
      type?: string;
      error?: string;
    };
    mcp_server: {
      version: string;
      capabilities: string[];
    };
  }> {
    return this.makeRequest('/health');
  }
}