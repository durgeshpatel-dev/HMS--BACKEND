/**
 * Custom error classes for consistent error handling across the application.
 * Use these instead of plain `throw new Error(msg)` so controllers can
 * determine the correct HTTP status code without fragile string matching.
 */

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
    this.name = 'BadRequestError';
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Helper: extract appropriate HTTP status code from an error object.
 * Works with both AppError instances and legacy `throw new Error('X not found')`.
 */
export function getErrorStatusCode(error: any, fallback: number = 500): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  // Legacy fallback: string-match for common patterns
  const msg = error?.message?.toLowerCase() ?? '';
  if (msg.includes('not found')) return 404;
  if (msg.includes('not available') || msg.includes('cannot')) return 400;
  return fallback;
}
