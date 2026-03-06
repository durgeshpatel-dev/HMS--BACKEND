import prisma from '../config/database';
import { hashPin } from '../utils/bcrypt.util';
import type { CreateStaffInput, UpdateStaffInput } from '../validators/staff.validator';

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
}

export const staffService = new StaffService();
