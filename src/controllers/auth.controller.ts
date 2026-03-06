import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.util';
import type { ManagerSignupInput, ManagerLoginInput, StaffLoginInput, RefreshTokenInput } from '../validators/auth.validator';

export class AuthController {
  // Manager Signup
  async managerSignup(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ManagerSignupInput = req.body;
      const result = await authService.managerSignup(data);
      return sendSuccess(
        res,
        result,
        'Account created successfully. Your account is pending approval by admin.',
        201
      );
    } catch (error: any) {
      if (error.message === 'Email already exists') {
        return sendError(res, error.message, 400);
      }
      return next(error);
    }
  }

  // Manager Login
  async managerLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ManagerLoginInput = req.body;
      const result = await authService.managerLogin(data);
      return sendSuccess(res, result, 'Login successful', 200);
    } catch (error: any) {
      if (
        error.message === 'Invalid credentials' ||
        error.message === 'Your account is pending approval' ||
        error.message === 'Your account application was rejected' ||
        error.message === 'Your account has been suspended'
      ) {
        return sendError(res, error.message, error.message === 'Invalid credentials' ? 401 : 403);
      }
      return next(error);
    }
  }

  // Staff Login (PIN-based)
  async staffLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const data: StaffLoginInput = req.body;
      const result = await authService.staffLogin(data);
      return sendSuccess(res, result, 'Login successful', 200);
    } catch (error: any) {
      if (
        error.message === 'Invalid phone number or PIN' ||
        error.message === 'Your account has been deactivated'
      ) {
        return sendError(res, error.message, 401);
      }
      return next(error);
    }
  }

  // Refresh Token
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken }: RefreshTokenInput = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
      return sendSuccess(res, result, 'Token refreshed successfully', 200);
    } catch (error: any) {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }
  }

  // Logout
  async logout(req: Request, res: Response) {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // Here we just confirm the action
    return sendSuccess(res, undefined, 'Logged out successfully', 200);
  }
}

export default new AuthController();
