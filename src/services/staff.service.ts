import prisma from '../config/database';
import { hashPin, comparePin } from '../utils/bcrypt.util';
import type { CreateStaffInput, UpdateStaffInput, ForgotStaffPinInput, ResetStaffPinInput } from '../validators/staff.validator';
import { verifyPhoneOtpToken } from '../utils/firebase.util';

class StaffService {
  async getAllStaff(restaurantId: number, role?: string) {
    return prisma.staff.findMany({
      where: {
        restaurantId,
        ...(role ? { role } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });
  }

  async createStaff(restaurantId: number, data: CreateStaffInput) {
    const existing = await prisma.staff.findUnique({
      where: { phone: data.phone },
    });

    if (existing) {
      throw new Error('Phone number already exists');
    }

    // Verify Firebase OTP token
    await verifyPhoneOtpToken(data.firebaseIdToken, data.phone);

    const pinHash = await hashPin(data.pin);

    return prisma.staff.create({
      data: {
        restaurantId,
        name: data.name,
        phone: data.phone,
        pinHash,
        role: data.role,
        isActive: data.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStaff(id: number, restaurantId: number, data: UpdateStaffInput) {
    const staff = await prisma.staff.findFirst({
      where: { id, restaurantId },
    });

    if (!staff) {
      throw new Error('Staff not found');
    }

    const updateData: any = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };

    if (data.pin) {
      updateData.pinHash = await hashPin(data.pin);
    }

    return prisma.staff.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });
  }

  async deleteStaff(id: number, restaurantId: number) {
    const staff = await prisma.staff.findFirst({
      where: { id, restaurantId },
    });

    if (!staff) {
      throw new Error('Staff not found');
    }

    await prisma.staff.delete({ where: { id } });
    return { message: 'Staff deleted successfully' };
  }

  async forgotPin(id: number, restaurantId: number, data: ForgotStaffPinInput) {
    const staff = await prisma.staff.findFirst({
      where: { id, restaurantId },
    });

    if (!staff) {
      throw new Error('Staff not found');
    }

    // Verify OTP using staff's registered phone
    await verifyPhoneOtpToken(data.firebaseIdToken, staff.phone);

    const pinHash = await hashPin(data.newPin);

    return prisma.staff.update({
      where: { id },
      data: { pinHash },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });
  }

  async resetPin(id: number, restaurantId: number, data: ResetStaffPinInput) {
    const staff = await prisma.staff.findFirst({
      where: { id, restaurantId },
    });

    if (!staff) {
      throw new Error('Staff not found');
    }

    const isValid = await comparePin(data.currentPin, staff.pinHash);
    if (!isValid) {
      throw new Error('Current PIN is incorrect');
    }

    const pinHash = await hashPin(data.newPin);

    return prisma.staff.update({
      where: { id },
      data: { pinHash },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });
  }
}

export const staffService = new StaffService();
