import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ConnectionError, AuthenticationError } from './errors.js';

export interface NeemeeClientOptions {
  transport: 'http' | 'stdio';
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
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

export interface SearchNotesParams {
  query?: string;
  notebook?: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
  tags?: string;
  limit?: number;
}

export class NeemeeMcpClient {
  private mcpClient: Client;
  private transport: SSEClientTransport | StdioClientTransport;

  constructor(options: NeemeeClientOptions) {
    this.mcpClient = new Client({
      name: 'neemee-mcp-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    if (options.transport === 'http') {
      this.transport = new SSEClientTransport(new URL(options.baseUrl || 'https://neemee.app/mcp'));
    } else {
      this.transport = new StdioClientTransport({ 
        command: 'node',
        args: []
      });
    }
  }

  get client(): Client {
    return this.mcpClient;
  }

  async connect(): Promise<void> {
    try {
      await this.mcpClient.connect(this.transport);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
          throw new AuthenticationError(error.message);
        }
        throw new ConnectionError(`Failed to connect: ${error.message}`);
      }
      throw new ConnectionError('Failed to connect to server');
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.mcpClient.close();
    } catch (error) {
      if (error instanceof Error) {
        throw new ConnectionError(`Failed to disconnect: ${error.message}`);
      }
      throw new ConnectionError('Failed to disconnect from server');
    }
  }
}