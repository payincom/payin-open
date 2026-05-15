/**
 * PayIn MCP Server - Cloudflare Workers Entry Point
 * Provides MCP interface for PayIn payment system
 */

import { PayInMcpServer } from './mcp-server.js';
import { PayInApiClient } from './lib/api-client.js';
import { extractApiConfig, Logger } from './lib/utils.js';
import type { Env } from './types/index.js';

/**
 * Cloudflare Worker Export
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const logger = new Logger(env.LOG_LEVEL || 'info');
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'payin-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // MCP endpoints - support both root (/) and /sse
    if (url.pathname === '/' || url.pathname === '/sse') {
      try {
        // Extract API configuration from headers
        const { apiKey, apiUrl } = extractApiConfig(request, env);

        // Create API client
        const apiClient = new PayInApiClient(apiUrl, apiKey, env.LOG_LEVEL);

        // Create MCP server instance
        const mcpServer = new PayInMcpServer(apiClient, env.LOG_LEVEL);

        // Handle request based on transport type
        if (url.pathname === '/') {
          // Streamable HTTP transport on root path
          return await handleStreamableHttp(request, mcpServer, logger);
        } else {
          // SSE transport
          return await handleSSE(request, mcpServer, logger);
        }
      } catch (error) {
        logger.error(`Error handling MCP request: ${error}`);

        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Handle Streamable HTTP transport
 */
async function handleStreamableHttp(
  request: Request,
  mcpServer: PayInMcpServer,
  logger: Logger
): Promise<Response> {
  // Parse request body
  const mcpRequest = await request.json() as any;

  // Handle MCP request
  const mcpResponse = await mcpServer.handleRequest(mcpRequest);

  // Return response
  return new Response(JSON.stringify(mcpResponse), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-PayIn-API-URL, X-PayIn-Network'
    }
  });
}

/**
 * Handle SSE (Server-Sent Events) transport
 */
async function handleSSE(
  request: Request,
  mcpServer: PayInMcpServer,
  logger: Logger
): Promise<Response> {
  // For SSE, we need to handle both GET (establish connection) and POST (send messages)

  if (request.method === 'GET') {
    // Establish SSE connection
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Keep connection alive
    const keepAlive = setInterval(() => {
      writer.write(encoder.encode(': keepalive\n\n'));
    }, 30000);

    // Close handler
    request.signal.addEventListener('abort', () => {
      clearInterval(keepAlive);
      writer.close();
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } else if (request.method === 'POST') {
    // Handle message
    return await handleStreamableHttp(request, mcpServer, logger);
  } else {
    return new Response('Method Not Allowed', { status: 405 });
  }
}
