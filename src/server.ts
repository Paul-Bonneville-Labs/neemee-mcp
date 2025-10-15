#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const VERSION = packageJson.version;

/**
 * Thin MCP server bridge that connects to frontend MCP server
 */
class NeemeeMcpServerBridge {
  private server: Server;
  private mcpClient: Client;
  private transport: StreamableHTTPClientTransport;

  constructor() {
    this.server = new Server(
      {
        name: 'neemee-mcp-server',
        version: VERSION,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Connect to frontend MCP server with URL validation and authentication
    const frontendUrl = this.validateAndGetFrontendUrl();
    const apiKey = this.getApiKey();
    
    // Create custom fetch function with authentication and proper Accept headers
    // The Accept header with text/event-stream is required to bypass Vercel's bot protection
    const authenticatedFetch = (url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${apiKey}`);
      // Ensure Accept header includes both JSON and SSE to satisfy Vercel's requirements
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json, text/event-stream');
      }
      return fetch(url, { ...init, headers });
    };
    
    // Create streamable HTTP transport with authenticated fetch
    this.transport = new StreamableHTTPClientTransport(frontendUrl, {
      fetch: authenticatedFetch
    });
    
    this.mcpClient = new Client({
      name: 'neemee-mcp-bridge',
      version: VERSION
    }, {
      capabilities: {}
    });

    this.setupHandlers();
  }

  private validateAndGetFrontendUrl(): URL {
    // Default to production URL for published package, localhost for development
    const defaultUrl = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev'
      ? 'http://localhost:3000/mcp'
      : 'https://neemee.paulbonneville.com/mcp';
    const frontendUrlString = process.env.NEEMEE_API_BASE_URL || defaultUrl;

    try {
      const url = new URL(frontendUrlString);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Invalid protocol: ${url.protocol}. Only HTTP and HTTPS are supported.`);
      }
      return url;
    } catch (error) {
      throw new Error(`Invalid NEEMEE_API_BASE_URL: "${frontendUrlString}". ${error instanceof Error ? error.message : 'Invalid URL format'}`);
    }
  }

  private getApiKey(): string {
    const apiKey = process.env.NEEMEE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'NEEMEE_API_KEY environment variable is required to authenticate with the frontend MCP server. ' +
        'Please set NEEMEE_API_KEY to your Neemee API key.'
      );
    }
    return apiKey;
  }

  async initialize(maxRetries: number = 3, retryDelayMs: number = 1000) {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.mcpClient.connect(this.transport);
        console.log(`Successfully connected to frontend MCP server`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }
        
        console.error(`Connection attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
        console.log(`Retrying in ${retryDelayMs}ms...`);
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
    
    // All retries failed
    const frontendUrl = this.validateAndGetFrontendUrl();
    throw new Error(
      `Failed to connect to frontend MCP server at ${frontendUrl.href} after ${maxRetries} attempts. ` +
      `Last error: ${lastError!.message}. ` +
      `Please check that the frontend server is running and NEEMEE_API_BASE_URL is correct.`
    );
  }

  private handleProxyError(error: unknown, operation: string): never {
    // Preserve original MCP errors
    if (error instanceof McpError) {
      throw error;
    }
    
    // Handle different error types with appropriate error codes
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new McpError(ErrorCode.RequestTimeout, `Frontend server timeout during ${operation}: ${error.message}`);
      }
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new McpError(ErrorCode.InternalError, `Cannot connect to frontend server for ${operation}. Check NEEMEE_API_BASE_URL: ${error.message}`);
      }
      if (error.message.includes('unauthorized') || error.message.includes('403')) {
        throw new McpError(ErrorCode.InvalidRequest, `Authentication failed for ${operation}: ${error.message}`);
      }
      if (error.message.includes('404')) {
        throw new McpError(ErrorCode.MethodNotFound, `Frontend server endpoint not found for ${operation}: ${error.message}`);
      }
      throw new McpError(ErrorCode.InternalError, `Failed to ${operation}: ${error.message}`);
    }
    
    throw new McpError(ErrorCode.InternalError, `Unknown error during ${operation}`);
  }

  private setupHandlers() {
    // List available tools - proxy from frontend MCP server
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const toolsResponse = await this.mcpClient.listTools();
        return toolsResponse;
      } catch (error) {
        this.handleProxyError(error, 'list tools');
      }
    });

    // List available resources - proxy from frontend MCP server
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resourcesResponse = await this.mcpClient.listResources();
        return resourcesResponse;
      } catch (error) {
        this.handleProxyError(error, 'list resources');
      }
    });

    // Read a resource - proxy from frontend MCP server
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const resourceResponse = await this.mcpClient.readResource(request.params);
        return resourceResponse;
      } catch (error) {
        this.handleProxyError(error, `read resource ${request.params.uri}`);
      }
    });

    // Call a tool - proxy from frontend MCP server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const toolResponse = await this.mcpClient.callTool(request.params);
        return toolResponse;
      } catch (error) {
        this.handleProxyError(error, `call tool ${request.params.name}`);
      }
    });
  }

  async run() {
    try {
      // First connect to frontend MCP server with retry logic
      await this.initialize();
      
      // Then start STDIO server for Claude Code
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log('Neemee MCP Server Bridge started and ready for Claude Code connections');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to start Neemee MCP Server Bridge:');
        console.error(error.message);
        if (error.message.includes('NEEMEE_API_BASE_URL')) {
          console.error('\nConfiguration help:');
          console.error('- For development: NEEMEE_API_BASE_URL=http://localhost:3000/mcp');
          console.error('- For production: NEEMEE_API_BASE_URL=https://neemee.paulbonneville.com/mcp');
          console.error('- Or set NODE_ENV=development to use localhost defaults');
        }
        if (error.message.includes('NEEMEE_API_KEY')) {
          console.error('\nAuthentication help:');
          console.error('- Set NEEMEE_API_KEY=your-api-key-here');
          console.error('- Get your API key from your Neemee dashboard');
        }
      } else {
        console.error('Failed to start Neemee MCP Server Bridge:', error);
      }
      process.exit(1);
    }
  }
}

// Start the bridge server
const bridge = new NeemeeMcpServerBridge();
bridge.run().catch(console.error);