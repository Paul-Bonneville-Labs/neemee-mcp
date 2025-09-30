import { McpError } from "@modelcontextprotocol/sdk/types.js";

export class NeemeeClientError extends Error {
  constructor(
    message: string,
    public code?: number,
    public originalError?: McpError
  ) {
    super(message);
    this.name = 'NeemeeClientError';
  }
}

export class AuthenticationError extends NeemeeClientError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class ConnectionError extends NeemeeClientError {
  constructor(message: string = 'Failed to connect to server') {
    super(message, 500);
    this.name = 'ConnectionError';
  }
}

export class NotFoundError extends NeemeeClientError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends NeemeeClientError {
  constructor(message: string = 'Invalid request parameters') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class ServerError extends NeemeeClientError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
    this.name = 'ServerError';
  }
}