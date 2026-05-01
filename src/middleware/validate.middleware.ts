import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response.util';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.slice(1).join('.'), // Remove 'body.' prefix for cleaner field names
          message: err.message,
          code: err.code,
        }));

        // Send the first error as the main message for better UX
        const mainError = errors[0];
        const message = `${mainError.field}: ${mainError.message}`;

        return sendError(res, message, 400, errors);
      }
      return sendError(res, 'Validation error', 400);
    }
  };
};
