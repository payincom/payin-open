/**
 * PayIn MCP Server
 * Core MCP protocol handler
 */

import { PayInApiClient } from './lib/api-client.js';
import { ApiError } from './lib/error-handler.js';
import { allTools } from './tools/index.js';
import { createAllResources } from './resources/index.js';
import { allPrompts } from './prompts/index.js';
import { Logger } from './lib/utils.js';
import type { Env } from './types/index.js';

/**
 * MCP Protocol Request
 */
interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * MCP Protocol Response
 */
interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * PayIn MCP Server
 */
export class PayInMcpServer {
  private apiClient: PayInApiClient;
  private logger: Logger;
  private tools: any[];
  private resources: any[];
  private prompts: any[];

  constructor(apiClient: PayInApiClient, logLevel: string = 'info') {
    this.apiClient = apiClient;
    this.logger = new Logger(logLevel);
    this.tools = allTools;
    this.resources = createAllResources(apiClient);
    this.prompts = allPrompts;
  }

  /**
   * Handle MCP request
   */
  async handleRequest(request: McpRequest): Promise<McpResponse> {
    this.logger.debug(`Handling MCP request: ${request.method}`);

    try {
      let result: any;

      switch (request.method) {
        case 'initialize':
          result = this.handleInitialize(request.params);
          break;

        case 'tools/list':
          result = this.handleListTools();
          break;

        case 'tools/call':
          result = await this.handleCallTool(request.params);
          break;

        case 'resources/list':
          result = this.handleListResources();
          break;

        case 'resources/read':
          result = await this.handleReadResource(request.params);
          break;

        case 'prompts/list':
          result = this.handleListPrompts();
          break;

        case 'prompts/get':
          result = await this.handleGetPrompt(request.params);
          break;

        default:
          throw new Error(`Unknown method: ${request.method}`);
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      this.logger.error(`Error handling request: ${error}`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: error instanceof ApiError ? error.mcpError : undefined
        }
      };
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(params: any) {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'payin-integration-assistant',
        version: '1.0.0'
      },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    };
  }

  /**
   * Handle tools/list request
   */
  private handleListTools() {
    return {
      tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleCallTool(params: any) {
    const { name, arguments: args } = params;

    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.logger.info(`Calling tool: ${name}`);

    const result = await tool.handler(args, this.apiClient);
    return result;
  }

  /**
   * Handle resources/list request
   */
  private handleListResources() {
    return {
      resources: this.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }))
    };
  }

  /**
   * Handle resources/read request
   */
  private async handleReadResource(params: any) {
    const { uri } = params;

    const resource = this.resources.find(r => r.uri === uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    this.logger.info(`Reading resource: ${uri}`);

    const result = await resource.handler();
    return result;
  }

  /**
   * Handle prompts/list request
   */
  private handleListPrompts() {
    return {
      prompts: this.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments || []
      }))
    };
  }

  /**
   * Handle prompts/get request
   */
  private async handleGetPrompt(params: any) {
    const { name, arguments: args } = params;

    const prompt = this.prompts.find(p => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    this.logger.info(`Getting prompt: ${name}`);

    const result = await prompt.handler(args || {});
    return result;
  }
}
