import prisma from '../config/database';
import { hashPassword, hashPin, comparePassword, comparePin } from '../utils/bcrypt.util';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt.util';
import type { ManagerSignupInput, ManagerLoginInput, StaffLoginInput } from '../validators/auth.validator';

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

    // Create restaurant and manager user in a transaction
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

      return { user, restaurant };
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      status: result.user.status,
      restaurantId: result.restaurant.id,
      restaurantName: result.restaurant.name,
    };
  }

  // Manager Login
  async managerLogin(data: ManagerLoginInput) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
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
