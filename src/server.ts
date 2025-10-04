#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Thin MCP server bridge that connects to frontend MCP server
 */
class NeeemeeMcpServerBridge {
  private server: Server;
  private mcpClient: Client;
  private transport: SSEClientTransport;

  constructor() {
    this.server = new Server(
      {
        name: 'neemee-mcp-server',
        version: '2.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Connect to frontend MCP server
    // Default to production URL for published package, localhost for development
    const defaultUrl = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev'
      ? 'http://localhost:3000/mcp'
      : 'https://neemee.paulbonneville.com/mcp';
    const frontendUrl = process.env.NEEMEE_API_BASE_URL || defaultUrl;
    this.transport = new SSEClientTransport(new URL(frontendUrl));
    
    this.mcpClient = new Client({
      name: 'neemee-mcp-bridge',
      version: '2.1.0'
    }, {
      capabilities: {}
    });

    this.setupHandlers();
  }

  async initialize() {
    await this.mcpClient.connect(this.transport);
  }

  private setupHandlers() {
    // List available tools - proxy from frontend MCP server
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const toolsResponse = await this.mcpClient.listTools();
        return toolsResponse;
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // List available resources - proxy from frontend MCP server
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resourcesResponse = await this.mcpClient.listResources();
        return resourcesResponse;
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Read a resource - proxy from frontend MCP server
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const resourceResponse = await this.mcpClient.readResource(request.params);
        return resourceResponse;
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Call a tool - proxy from frontend MCP server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const toolResponse = await this.mcpClient.callTool(request.params);
        return toolResponse;
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to call tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  async run() {
    // First connect to frontend MCP server
    await this.initialize();
    
    // Then start STDIO server for Claude Code
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Neemee MCP Server Bridge started and connected to frontend MCP server');
  }
}

// Start the bridge server
const bridge = new NeeemeeMcpServerBridge();
bridge.run().catch(console.error);