import { z } from 'zod';

export const managerSignupSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
    restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
    address: z.string().optional(),
  }),
});

export const managerLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const staffLoginSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
    pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const verifySignupOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  }),
});

export const resendSignupOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20, 'Invalid reset token'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

export type ManagerSignupInput = z.infer<typeof managerSignupSchema>['body'];
export type ManagerLoginInput = z.infer<typeof managerLoginSchema>['body'];
export type StaffLoginInput = z.infer<typeof staffLoginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type VerifySignupOtpInput = z.infer<typeof verifySignupOtpSchema>['body'];
export type ResendSignupOtpInput = z.infer<typeof resendSignupOtpSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
