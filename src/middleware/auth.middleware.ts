import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';
import { verifyAccessToken } from '../utils/jwt.util';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void | Response => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    (req as any).user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    return sendError(res, 'Authentication failed', 401);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const user = (req as any).user;
    if (!user) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }

    next();
  };
};
