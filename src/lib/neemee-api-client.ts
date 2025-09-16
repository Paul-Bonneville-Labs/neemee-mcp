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
  tags?: string | string[];
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

export class NeemeeApiError extends Error {
  public code: number;
  public data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'NeemeeApiError';
    this.code = code;
    this.data = data;
  }

  static fromJsonRpcError(error: { code: number; message: string; data?: unknown }): NeemeeApiError {
    return new NeemeeApiError(error.message, error.code, error.data);
  }
}

export class NeemeeApiClient {
  private baseUrl: string;
  private apiKey: string;
  private requestIdCounter: number = 1;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.NEEMEE_API_BASE_URL || 'https://neemee.paulbonneville.com/mcp';
    this.apiKey = apiKey || process.env.NEEMEE_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('NEEMEE_API_KEY is required');
    }
  }

  private generateRequestId(): number {
    return this.requestIdCounter++;
  }

  // Helper functions for response parsing
  private parseJsonResponse<T>(responseText: string, operation: string): T {
    try {
      return JSON.parse(responseText);
    } catch (err) {
      throw new Error(`Failed to parse JSON in ${operation} response: ${(err as Error).message}`);
    }
  }

  private parseToolResponse<T>(response: { content: Array<{ type: string; text: string }> }, operation: string): T {
    return this.parseJsonResponse<T>(response.content[0].text, operation);
  }

  private parseResourceResponse<T>(response: { contents: Array<{ uri: string; mimeType: string; text: string }> }, operation: string): T {
    return this.parseJsonResponse<T>(response.contents[0].text, operation);
  }

  private parseResponseText(responseText: string, patterns: { [key: string]: RegExp }): { [key: string]: string } {
    const results: { [key: string]: string } = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = responseText.match(pattern);
      if (match) {
        results[key] = match[1];
      }
    }
    
    return results;
  }

  private async makeJsonRpcRequest<T>(method: string, params?: any): Promise<T> {
    const request = {
      jsonrpc: "2.0" as const,
      id: this.generateRequestId(),
      method,
      params: params || {}
    };
    
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'MCP-Protocol-Version': '2025-06-18',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`JSON-RPC request failed: ${response.status} ${response.statusText}: ${error}`);
    }

    const jsonResponse = await response.json() as {
      jsonrpc: string;
      id: number;
      result?: T;
      error?: { code: number; message: string; data?: unknown };
    };
    
    if (jsonResponse.error) {
      throw NeemeeApiError.fromJsonRpcError(jsonResponse.error);
    }

    return jsonResponse.result!;
  }


  // Authentication - now uses JSON-RPC initialize
  async validateAuth(): Promise<AuthContext> {
    const response = await this.makeJsonRpcRequest<{
      protocolVersion: string;
      capabilities: any;
      serverInfo: any;
      _auth?: {
        userId: string;
        scopes: string[];
      };
    }>('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {
        resources: {},
        tools: {}
      },
      clientInfo: {
        name: 'neemee-mcp-client',
        version: '1.0.0'
      }
    });

    if (!response._auth) {
      throw new Error('Authentication failed: No auth context in initialize response');
    }

    return {
      userId: response._auth.userId,
      authType: 'api-key',
      scopes: response._auth.scopes,
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
    const searchArgs: any = {};
    
    if (params.query) searchArgs.query = params.query;
    if (params.notebook) searchArgs.notebook = params.notebook;
    if (params.domain) searchArgs.domain = params.domain;
    if (params.startDate) searchArgs.startDate = params.startDate;
    if (params.endDate) searchArgs.endDate = params.endDate;
    if (params.tags) {
      searchArgs.tags = Array.isArray(params.tags) ? params.tags.join(',') : params.tags;
    }
    if (params.limit) searchArgs.limit = params.limit;
    if (params.page) searchArgs.page = params.page;

    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'search_notes',
      arguments: searchArgs
    });

    return this.parseToolResponse(response, 'searchNotes');
  }

  async getNote(id: string): Promise<NeemeeNote> {
    const response = await this.makeJsonRpcRequest<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>('resources/read', {
      uri: `notes://${id}`
    });

    return this.parseResourceResponse(response, 'getNote');
  }

  async createNote(params: CreateNoteParams): Promise<{
    id: string;
    noteTitle: string;
    notebookId: string | null;
    notebook?: { name: string } | null;
  }> {
    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'create_note',
      arguments: params
    });

    const responseText = response.content[0].text;
    const results = this.parseResponseText(responseText, {
      id: /ID: ([a-zA-Z0-9-]+)/,
      title: /note "([^"]+)"/,
      notebook: /in notebook "([^"]+)"/
    });

    if (!results.id || !results.title) {
      throw new Error('Failed to parse create note response');
    }

    return {
      id: results.id,
      noteTitle: results.title,
      notebookId: null,
      notebook: results.notebook ? { name: results.notebook } : null
    };
  }

  async updateNote(params: UpdateNoteParams): Promise<{
    id: string;
    noteTitle: string;
  }> {
    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'update_note',
      arguments: params
    });

    const responseText = response.content[0].text;
    const results = this.parseResponseText(responseText, {
      id: /ID: ([a-zA-Z0-9-]+)/,
      title: /note "([^"]+)"/
    });

    if (!results.id || !results.title) {
      throw new Error('Failed to parse update note response');
    }

    return {
      id: results.id,
      noteTitle: results.title
    };
  }

  async deleteNote(id: string): Promise<{
    id: string;
    noteTitle: string;
  }> {
    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'delete_note',
      arguments: { id, confirm: true }
    });

    const responseText = response.content[0].text;
    const results = this.parseResponseText(responseText, {
      id: /ID: ([a-zA-Z0-9-]+)/,
      title: /note "([^"]+)"/
    });

    if (!results.id || !results.title) {
      throw new Error('Failed to parse delete note response');
    }

    return {
      id: results.id,
      noteTitle: results.title
    };
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
    const searchArgs: any = {};
    
    if (params.query) searchArgs.query = params.query;
    if (params.limit) searchArgs.limit = params.limit;
    if (params.page) searchArgs.page = params.page;

    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'search_notebooks',
      arguments: searchArgs
    });

    return this.parseToolResponse(response, 'searchNotebooks');
  }

  async getNotebook(id: string): Promise<NeemeeNotebook> {
    const response = await this.makeJsonRpcRequest<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>('resources/read', {
      uri: `notebooks://${id}`
    });

    return this.parseResourceResponse(response, 'getNotebook');
  }

  async createNotebook(params: CreateNotebookParams): Promise<{
    id: string;
    name: string;
    description: string | null;
  }> {
    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'create_notebook',
      arguments: params
    });

    const responseText = response.content[0].text;
    const results = this.parseResponseText(responseText, {
      id: /ID: ([a-zA-Z0-9-]+)/,
      name: /notebook "([^"]+)"/
    });

    if (!results.id || !results.name) {
      throw new Error('Failed to parse create notebook response');
    }

    return {
      id: results.id,
      name: results.name,
      description: params.description || null
    };
  }

  async updateNotebook(params: UpdateNotebookParams): Promise<{
    id: string;
    name: string;
  }> {
    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'update_notebook',
      arguments: params
    });

    const responseText = response.content[0].text;
    const results = this.parseResponseText(responseText, {
      id: /ID: ([a-zA-Z0-9-]+)/,
      name: /notebook "([^"]+)"/
    });

    if (!results.id || !results.name) {
      throw new Error('Failed to parse update notebook response');
    }

    return {
      id: results.id,
      name: results.name
    };
  }

  async deleteNotebook(id: string): Promise<{
    id: string;
    name: string;
    noteCount: number;
  }> {
    const response = await this.makeJsonRpcRequest<{
      content: Array<{ type: string; text: string }>;
    }>('tools/call', {
      name: 'delete_notebook',
      arguments: { id, confirm: true }
    });

    const responseText = response.content[0].text;
    const results = this.parseResponseText(responseText, {
      id: /ID: ([a-zA-Z0-9-]+)/,
      name: /notebook "([^"]+)"/,
      count: /(\d+) notes/
    });

    if (!results.id || !results.name) {
      throw new Error('Failed to parse delete notebook response');
    }

    return {
      id: results.id,
      name: results.name,
      noteCount: results.count ? parseInt(results.count) : 0
    };
  }

  // Statistics
  async getStats(): Promise<{
    totalNotes: number;
    recentActivity: number;
    topDomains: Array<{ domain: string; count: number }>;
    generatedAt: string;
  }> {
    const response = await this.makeJsonRpcRequest<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>('resources/read', {
      uri: 'stats://overview'
    });

    return this.parseResourceResponse(response, 'getStats');
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
    const response = await this.makeJsonRpcRequest<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>('resources/read', {
      uri: 'collections://recent'
    });

    return this.parseResourceResponse(response, 'getRecentActivity');
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
    const response = await this.makeJsonRpcRequest<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>('resources/read', {
      uri: 'system://health'
    });

    return this.parseResourceResponse(response, 'healthCheck');
  }
}