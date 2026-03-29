import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import {
  managerSignupSchema,
  managerLoginSchema,
  staffLoginSchema,
  refreshTokenSchema,
  verifySignupOtpSchema,
  resendSignupOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// Manager Authentication
router.post(
  '/manager/signup',
  authRateLimiter,
  validate(managerSignupSchema),
  authController.managerSignup.bind(authController)
);

router.post(
  '/manager/login',
  authRateLimiter,
  validate(managerLoginSchema),
  authController.managerLogin.bind(authController)
);

router.post(
  '/manager/verify-signup-otp',
  authRateLimiter,
  validate(verifySignupOtpSchema),
  authController.verifySignupOtp.bind(authController)
);

router.post(
  '/manager/resend-signup-otp',
  authRateLimiter,
  validate(resendSignupOtpSchema),
  authController.resendSignupOtp.bind(authController)
);

router.post(
  '/manager/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController)
);

router.post(
  '/manager/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController)
);

// Staff Authentication
router.post(
  '/staff/login',
  authRateLimiter,
  validate(staffLoginSchema),
  authController.staffLogin.bind(authController)
);

// Token Management
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

router.post(
  '/logout',
  requireAuth,
  authController.logout.bind(authController)
);

export default router;
