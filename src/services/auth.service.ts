import prisma from '../config/database';
import { hashPassword, hashPin, comparePassword, comparePin } from '../utils/bcrypt.util';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt.util';
import type {
  ManagerSignupInput,
  ManagerLoginInput,
  StaffLoginInput,
  VerifySignupOtpInput,
  ResendSignupOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validators/auth.validator';
import crypto from 'crypto';
import config from '../config/env';
import emailService from './email.service';

const hashValue = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const generateSixDigitOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const MAX_OTP_ATTEMPTS = 5;

export class AuthService {
  // Manager Signup
  async managerSignup(data: ManagerSignupInput) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create restaurant + manager user + signup OTP in a transaction
    const otp = generateSixDigitOtp();
    const otpHash = hashValue(otp);
    const otpExpiry = new Date(Date.now() + config.authFlow.signupOtpTtlMinutes * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      // Create restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          email: data.email,
          phone: data.phone,
          address: data.address,
        },
      });

      // Create manager user
      const user = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          email: data.email,
          passwordHash,
          name: data.name,
          phone: data.phone,
          role: 'manager',
          status: 'pending_approval',
        },
      });

      await tx.userOtpVerification.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt: otpExpiry,
          attempts: 0,
          verifiedAt: null,
        },
      });

      return { user, restaurant };
    }, { timeout: 15000 });

    emailService.sendSignupOtp(result.user.email, result.user.name, otp);

    return {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      status: result.user.status,
      restaurantId: result.restaurant.id,
      restaurantName: result.restaurant.name,
      verificationRequired: true,
    };
  }

  async verifySignupOtp(data: VerifySignupOtpInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        otpVerification: true,
      },
    });

    if (!user || !user.otpVerification) {
      throw new Error('Invalid OTP request');
    }

    const verification = user.otpVerification;

    if (verification.verifiedAt) {
      return { verified: true, alreadyVerified: true };
    }

    if (verification.attempts >= MAX_OTP_ATTEMPTS) {
      throw new Error('Too many invalid OTP attempts. Please request a new OTP');
    }

    if (verification.expiresAt.getTime() < Date.now()) {
      throw new Error('OTP has expired. Please request a new OTP');
    }

    const isValid = hashValue(data.otp) === verification.otpHash;
    if (!isValid) {
      await prisma.userOtpVerification.update({
        where: { userId: user.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error('Invalid OTP');
    }

    await prisma.userOtpVerification.update({
      where: { userId: user.id },
      data: {
        verifiedAt: new Date(),
      },
    });

    return {
      verified: true,
      status: user.status,
    };
  }

  async resendSignupOtp(data: ResendSignupOtpInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        otpVerification: true,
      },
    });

    if (!user) {
      // Do not reveal user existence
      return { sent: true };
    }

    if (user.role !== 'manager') {
      return { sent: true };
    }

    if (user.otpVerification?.verifiedAt) {
      return { sent: false, alreadyVerified: true };
    }

    const otp = generateSixDigitOtp();
    const otpHash = hashValue(otp);
    const otpExpiry = new Date(Date.now() + config.authFlow.signupOtpTtlMinutes * 60 * 1000);

    await prisma.userOtpVerification.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        otpHash,
        expiresAt: otpExpiry,
        attempts: 0,
      },
      update: {
        otpHash,
        expiresAt: otpExpiry,
        attempts: 0,
        verifiedAt: null,
      },
    });

    emailService.sendSignupOtp(user.email, user.name, otp);
    return { sent: true };
  }

  // Manager Login
  async managerLogin(data: ManagerLoginInput) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        otpVerification: {
          select: {
            verifiedAt: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    if (user.otpVerification && !user.otpVerification.verifiedAt) {
      throw new Error('Please verify your email with OTP before login');
    }

    // Check account status
    if (user.status === 'pending_approval') {
      throw new Error('Your account is pending approval');
    }

    if (user.status === 'rejected') {
      throw new Error('Your account application was rejected');
    }

    if (user.status === 'suspended') {
      throw new Error('Your account has been suspended');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      userType: 'manager',
      role: user.role,
      restaurantId: user.restaurantId,
      email: user.email,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({
      userId: user.id,
      userType: 'manager',
      role: user.role,
      restaurantId: user.restaurantId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        restaurantId: user.restaurantId,
        restaurant: user.restaurant,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour in seconds
      },
    };
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Do not reveal account existence
    if (!user || user.role !== 'manager') {
      return { sent: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(token);
    const expiresAt = new Date(Date.now() + config.authFlow.passwordResetTtlMinutes * 60 * 1000);

    await prisma.userPasswordReset.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      update: {
        tokenHash,
        expiresAt,
        consumedAt: null,
        requestedAt: new Date(),
      },
    });

    const resetUrl = `${config.app.frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    const sent = await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    return { sent };
  }

  async resetPassword(data: ResetPasswordInput) {
    const tokenHash = hashValue(data.token);

    const request = await prisma.userPasswordReset.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!request || request.consumedAt || request.expiresAt.getTime() < Date.now()) {
      throw new Error('Invalid or expired reset link');
    }

    const passwordHash = await hashPassword(data.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: {
          passwordHash,
        },
      });

      await tx.userPasswordReset.update({
        where: { userId: request.userId },
        data: {
          consumedAt: new Date(),
        },
      });
    }, { timeout: 15000 });

    return { reset: true };
  }

  // Staff Login (PIN-based)
  async staffLogin(data: StaffLoginInput) {
    // Find staff by phone
    const staff = await prisma.staff.findUnique({
      where: { phone: data.phone },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!staff) {
      throw new Error('Invalid phone number or PIN');
    }

    // Check if staff is active
    if (!staff.isActive) {
      throw new Error('Your account has been deactivated');
    }

    // Check PIN
    const isPinValid = await comparePin(data.pin, staff.pinHash);
    if (!isPinValid) {
      throw new Error('Invalid phone number or PIN');
    }

    // Update last login
    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: staff.id,
      userType: 'staff',
      role: staff.role,
      restaurantId: staff.restaurantId,
      phone: staff.phone,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({
      userId: staff.id,
      userType: 'staff',
      role: staff.role,
      restaurantId: staff.restaurantId,
    });

    return {
      user: {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        role: staff.role,
        restaurantId: staff.restaurantId,
        restaurant: staff.restaurant,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
      },
    };
  }

  // Refresh Token
  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      if (decoded.userType === 'manager') {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (!user || user.status !== 'active') {
          throw new Error('User not found or inactive');
        }

        const newAccessToken = generateAccessToken({
          userId: user.id,
          userType: 'manager',
          role: user.role,
          restaurantId: user.restaurantId,
          email: user.email,
        });

        return {
          accessToken: newAccessToken,
          expiresIn: 3600,
        };
      } else {
        const staff = await prisma.staff.findUnique({
          where: { id: decoded.userId },
        });

        if (!staff || !staff.isActive) {
          throw new Error('Staff not found or inactive');
        }

        const newAccessToken = generateAccessToken({
          userId: staff.id,
          userType: 'staff',
          role: staff.role,
          restaurantId: staff.restaurantId,
          phone: staff.phone,
        });

        return {
          accessToken: newAccessToken,
          expiresIn: 3600,
        };
      }
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }
}

export default new AuthService();
