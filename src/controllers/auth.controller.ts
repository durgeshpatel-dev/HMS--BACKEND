import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.util';
import type {
  ManagerSignupInput,
  ManagerLoginInput,
  StaffLoginInput,
  RefreshTokenInput,
  VerifySignupOtpInput,
  ResendSignupOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validators/auth.validator';
import { getErrorStatusCode } from '../utils/errors.util';

export class AuthController {
  // Manager Signup
  async managerSignup(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ManagerSignupInput = req.body;
      const result = await authService.managerSignup(data);
      const message = result.otpSent === false
        ? 'Account created, but OTP email could not be sent. Please try resend OTP or contact support.'
        : 'Account created. Verify OTP sent to your email, then wait for admin approval.';
      return sendSuccess(
        res,
        result,
        message,
        201
      );
    } catch (error: any) {
      // Handle specific business logic errors with proper status codes
      const statusCode = getErrorStatusCode(error, 500);
      const errorMessage = error.message;

      // For service unavailable errors, provide a user-friendly message
      if (errorMessage.includes('timeout') || errorMessage.includes('transaction')) {
        return sendError(res, 'Service temporarily unavailable. Please try again.', 503);
      }

      // Return the specific error message with appropriate status code
      return sendError(res, errorMessage, statusCode);
    }
  }

  // Manager Login
  async managerLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ManagerLoginInput = req.body;
      const result = await authService.managerLogin(data);
      return sendSuccess(res, result, 'Login successful', 200);
    } catch (error: any) {
      const statusCode = getErrorStatusCode(error, 500);
      const errorMessage = error.message;

      // For service unavailable errors, provide a user-friendly message
      if (errorMessage.includes('timeout') || errorMessage.includes('transaction')) {
        return sendError(res, 'Service temporarily unavailable. Please try again.', 503);
      }

      // Return the specific error message with appropriate status code
      return sendError(res, errorMessage, statusCode);
    }
  }

  async verifySignupOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data: VerifySignupOtpInput = req.body;
      const result = await authService.verifySignupOtp(data);
      return sendSuccess(res, result, 'Email verified successfully', 200);
    } catch (error: any) {
      const statusCode = getErrorStatusCode(error, 500);
      const errorMessage = error.message;

      // For service unavailable errors, provide a user-friendly message
      if (errorMessage.includes('timeout') || errorMessage.includes('transaction')) {
        return sendError(res, 'Service temporarily unavailable. Please try again.', 503);
      }

      // Return the specific error message with appropriate status code
      return sendError(res, errorMessage, statusCode);
    }
  }

  async resendSignupOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ResendSignupOtpInput = req.body;
      const result = await authService.resendSignupOtp(data);
      const message = result.signupExpired
        ? 'Signup session expired. Please sign up again.'
        : result.sent === false
          ? 'We could not send OTP right now. Please try again in a minute.'
          : 'If eligible, a new OTP has been sent';
      return sendSuccess(res, result, message, 200);
    } catch (error: any) {
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
      const statusCode = getErrorStatusCode(error, 500);
      const errorMessage = error.message;

      // For service unavailable errors, provide a user-friendly message
      if (errorMessage.includes('timeout') || errorMessage.includes('transaction')) {
        return sendError(res, 'Service temporarily unavailable. Please try again.', 503);
      }

      // Return the specific error message with appropriate status code
      return sendError(res, errorMessage, statusCode);
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

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ForgotPasswordInput = req.body;
      const result = await authService.forgotPassword(data);
      const message = result.otpNotVerified
        ? 'Please verify your email with OTP before requesting password reset'
        : 'If that email exists, a reset link has been sent';
      return sendSuccess(res, result, message, 200);
    } catch (error: any) {
      return next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ResetPasswordInput = req.body;
      const result = await authService.resetPassword(data);
      return sendSuccess(res, result, 'Password reset successful', 200);
    } catch (error: any) {
      if (
        error.message === 'Invalid or expired reset link' ||
        error.message === 'Please verify your email with OTP before resetting password'
      ) {
        return sendError(res, error.message, 400);
      }
      return next(error);
    }
  }
}

export default new AuthController();
