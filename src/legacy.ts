import { NeemeeClient } from './index.js';
import type { NeemeeClientOptions } from './client.js';

interface LegacyClientOptions {
  useStdio?: boolean;
  serverUrl?: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * @deprecated Use NeemeeClient instead
 * Legacy wrapper for backward compatibility with v1.x API
 */
export class LegacyNeemeeClient {
  private client: NeemeeClient;

  constructor(options: LegacyClientOptions = {}) {
    const clientOptions: NeemeeClientOptions = {
      transport: options.useStdio ? 'stdio' : 'http',
      baseUrl: options.serverUrl,
      apiKey: options.apiKey,
      timeout: options.timeout
    };

    this.client = new NeemeeClient(clientOptions);
  }

  async connect(): Promise<void> {
    return await this.client.connect();
  }

  async disconnect(): Promise<void> {
    return await this.client.disconnect();
  }

  async createNote(content: string, title?: string, metadata?: any): Promise<any> {
    const result = await this.client.tools.createNote({
      content,
      title,
      frontmatter: metadata
    });
    return result;
  }

  async updateNote(id: string, content?: string, title?: string, metadata?: any): Promise<any> {
    const result = await this.client.tools.updateNote({
      id,
      content,
      title,
      frontmatter: metadata
    });
    return result;
  }

  async deleteNote(id: string): Promise<any> {
    return await this.client.tools.deleteNote(id, true);
  }

  async searchNotes(query?: string, options?: any): Promise<any> {
    return await this.client.tools.searchNotes({
      query,
      ...options
    });
  }

  async listNotes(options?: any): Promise<any> {
    return await this.client.resources.listNotes(options);
  }

  async getNote(id: string): Promise<any> {
    return await this.client.resources.getNote(id);
  }

  async createNotebook(name: string, description?: string): Promise<any> {
    return await this.client.tools.createNotebook(name, description);
  }

  async updateNotebook(id: string, name?: string, description?: string): Promise<any> {
    return await this.client.tools.updateNotebook(id, name, description);
  }

  async deleteNotebook(id: string): Promise<any> {
    return await this.client.tools.deleteNotebook(id, true);
  }

  async listNotebooks(options?: any): Promise<any> {
    return await this.client.resources.listNotebooks(options);
  }

  async getNotebook(id: string): Promise<any> {
    return await this.client.resources.getNotebook(id);
  }

  async getStats(): Promise<any> {
    return await this.client.resources.getStats();
  }

  async getHealth(): Promise<any> {
    return await this.client.resources.getHealth();
  }
}