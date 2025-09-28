import { Client } from "@modelcontextprotocol/sdk/client/index.js";

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
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const uri = `notes://list${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return await this.client.readResource({ uri });
  }

  async getNote(id: string): Promise<any> {
    return await this.client.readResource({ uri: `notes://${id}` });
  }

  async listNotebooks(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const uri = `notebooks://list${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return await this.client.readResource({ uri });
  }

  async getNotebook(id: string): Promise<any> {
    return await this.client.readResource({ uri: `notebooks://${id}` });
  }

  async getStats(): Promise<any> {
    return await this.client.readResource({ uri: 'stats://overview' });
  }

  async getHealth(): Promise<any> {
    return await this.client.readResource({ uri: 'system://health' });
  }

  async getRecentActivity(): Promise<any> {
    return await this.client.readResource({ uri: 'collections://recent' });
  }
}