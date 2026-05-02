import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';
import { verifyAccessToken } from '../utils/jwt.util';

/**
 * Middleware that verifies the caller is a super admin.
 * The JWT must have been issued by the super admin login endpoint
 * with userType: 'super_admin' and role: 'super_admin'.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void | Response => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    if (decoded.userType !== 'super_admin' || decoded.role !== 'super_admin') {
      return sendError(res, 'Super admin access required', 403);
    }

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
