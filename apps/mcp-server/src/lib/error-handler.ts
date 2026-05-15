/**
 * Error handling for PayIn API responses
 */

import type { McpError } from '../types/index.js';
import { createErrorResponse } from './utils.js';

function buildDetails(status: number, body: any = {}, extra: Record<string, any> = {}) {
  const details: Record<string, any> = { status };

  if (body?.code) details.apiCode = body.code;
  if (body?.error) details.apiError = body.error;
  if (body?.message) details.apiMessage = body.message;
  if (body?.details) details.apiDetails = body.details;
  if (body?.validationErrors || body?.errors) {
    details.validationErrors = body.validationErrors ?? body.errors;
  }

  return {
    ...details,
    ...extra
  };
}

function pickSuggestions(body: any, fallback: string[]): string[] {
  return Array.isArray(body?.suggestions) && body.suggestions.length > 0
    ? body.suggestions
    : fallback;
}

/**
 * Handle API errors and convert to MCP errors
 */
export async function handleApiError(response: Response): Promise<McpError> {
  let body: any;
  try {
    body = await response.json();
  } catch {
    body = { message: await response.text() };
  }

  // Authentication errors (401)
  if (response.status === 401) {
    return createErrorResponse(
      body.code || 'AUTHENTICATION_FAILED',
      body.message || 'API authentication failed',
      pickSuggestions(body, [
        'Check that X-API-Key header is correctly configured in MCP client',
        'Verify the API Key is valid in PayIn Admin',
        'Ensure the API URL is correct'
      ]),
      buildDetails(response.status, body)
    );
  }

  // Permission errors (403)
  if (response.status === 403) {
    const requiredPermission = body.permission || 'unknown';
    return createErrorResponse(
      body.code || 'PERMISSION_DENIED',
      body.message || 'Insufficient permissions',
      pickSuggestions(body, [
        `Current API Key lacks '${requiredPermission}' permission`,
        'Grant the required permission in PayIn Admin',
        'Or use an API Key with sufficient permissions'
      ]),
      buildDetails(response.status, body, { requiredPermission })
    );
  }

  // Not found errors (404)
  if (response.status === 404) {
    return createErrorResponse(
      body.code || 'RESOURCE_NOT_FOUND',
      body.message || 'Resource not found',
      pickSuggestions(body, [
        'Verify the resource ID is correct',
        'Check if the resource exists in the system',
        'Ensure you are using the correct API endpoint'
      ]),
      buildDetails(response.status, body)
    );
  }

  // Validation errors (400)
  if (response.status === 400) {
    return createErrorResponse(
      body.code || 'INVALID_PARAMETERS',
      body.message || 'Invalid request parameters',
      pickSuggestions(body, [
        'Check the required parameters for this operation',
        'Verify parameter formats and types',
        'See API reference for parameter details'
      ]),
      buildDetails(response.status, body)
    );
  }

  // Conflict errors (409)
  if (response.status === 409) {
    return createErrorResponse(
      body.code || 'CONFLICT',
      body.message || 'Request conflicts with current state',
      pickSuggestions(body, [
        'Review the API response for remediation steps',
        'Retry after resolving the reported conflict'
      ]),
      buildDetails(response.status, body)
    );
  }

  // Rate limiting (429)
  if (response.status === 429) {
    return createErrorResponse(
      body.code || 'RATE_LIMIT_EXCEEDED',
      body.message || 'API rate limit exceeded',
      pickSuggestions(body, [
        'Wait a moment before retrying',
        'Consider implementing request throttling',
        'Contact support if you need higher rate limits'
      ]),
      buildDetails(response.status, body)
    );
  }

  // Server errors (500+)
  if (response.status >= 500) {
    return createErrorResponse(
      body.code || 'SERVER_ERROR',
      body.message || 'PayIn API server error',
      pickSuggestions(body, [
        'This is likely a temporary issue',
        'Retry the operation after a short delay',
        'Contact support if the issue persists'
      ]),
      buildDetails(response.status, body)
    );
  }

  // Generic error
  return createErrorResponse(
    body.code || 'API_ERROR',
    body.message || `API request failed with status ${response.status}`,
    pickSuggestions(body, ['Check the error details', 'Verify your request parameters']),
    buildDetails(response.status, body)
  );
}

/**
 * Error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public mcpError: McpError,
    public status: number
  ) {
    super(mcpError.message);
    this.name = 'ApiError';
  }
}
