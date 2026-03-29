import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';

const prisma = new PrismaClient();
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

// Admin: Approve manager account (quick endpoint for development)
router.post('/admin/approve-manager', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const user = await prisma.user.update({
      where: { email },
      data: { status: 'active' }
    });
    
    res.json({ success: true, email: user.email, status: user.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
