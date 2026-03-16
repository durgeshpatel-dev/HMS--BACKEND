import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  console.error('Error:', {
    message: err.message,
    statusCode: err.statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err.message || 'Request failed');

  return sendError(res, message, statusCode);
};

export const notFoundHandler = (req: Request, res: Response): Response => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};
