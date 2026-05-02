import prisma from '../config/database';
import { hashPassword, hashPin } from '../utils/bcrypt.util';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';

// Hardcoded super admin credentials
const SUPER_ADMIN_EMAIL = 'durgeshdesai13@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Dppatel@66';

class SuperAdminService {
  // ─── Auth ────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    if (email !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
      throw new Error('Invalid credentials');
    }

    const tokenPayload = {
      userId: 0,
      userType: 'super_admin' as const,
      role: 'super_admin',
      restaurantId: 0,
      email: SUPER_ADMIN_EMAIL,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({
      userId: 0,
      userType: 'super_admin' as const,
      role: 'super_admin',
      restaurantId: 0,
    });

    return {
      user: { email: SUPER_ADMIN_EMAIL, name: 'Super Admin', role: 'super_admin' },
      tokens: { accessToken, refreshToken, expiresIn: 3600 },
    };
  }

  // ─── Platform Stats ──────────────────────────────────────────────────

  async getPlatformStats() {
    const [
      totalRestaurants,
      activeRestaurants,
      pausedRestaurants,
      totalManagers,
      pendingApprovals,
      activeManagers,
      suspendedManagers,
      rejectedManagers,
      totalStaff,
      totalOrders,
      completedOrders,
      totalBills,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { status: 'active' } }),
      prisma.restaurant.count({ where: { status: 'paused' } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'pending_approval' } }),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'suspended' } }),
      prisma.user.count({ where: { status: 'rejected' } }),
      prisma.staff.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'completed' } }),
      prisma.bill.count(),
    ]);

    // Total revenue from all paid bills
    const revenueResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'success' },
    });

    return {
      totalRestaurants,
      activeRestaurants,
      pausedRestaurants,
      totalManagers,
      pendingApprovals,
      activeManagers,
      suspendedManagers,
      rejectedManagers,
      totalStaff,
      totalOrders,
      completedOrders,
      totalBills,
      totalRevenue: Number(revenueResult._sum.amount || 0),
    };
  }

  // ─── Restaurant Management ───────────────────────────────────────────

  async getAllRestaurants(search?: string, status?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            staff: true,
            orders: true,
            menuItems: true,
            tables: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return restaurants;
  }

  async getRestaurantById(id: number) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true, name: true, email: true, role: true, status: true,
            lastLogin: true, createdAt: true,
          },
        },
        staff: {
          select: {
            id: true, name: true, phone: true, role: true, isActive: true,
            lastLogin: true, createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
            menuItems: true,
            tables: true,
            categories: true,
            bills: true,
          },
        },
      },
    });

    if (!restaurant) throw new Error('Restaurant not found');

    // Get revenue for this restaurant
    const revenueResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { restaurantId: id, status: 'success' },
    });

    return {
      ...restaurant,
      totalRevenue: Number(revenueResult._sum.amount || 0),
    };
  }

  async updateRestaurant(id: number, data: {
    name?: string; email?: string; phone?: string; address?: string;
  }) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new Error('Restaurant not found');

    if (data.email && data.email !== restaurant.email) {
      const existing = await prisma.restaurant.findFirst({
        where: { email: data.email, id: { not: id } },
      });
      if (existing) throw new Error('Email already in use by another restaurant');
    }

    return prisma.restaurant.update({ where: { id }, data });
  }

  async updateRestaurantSettings(id: number, settings: Record<string, unknown>) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new Error('Restaurant not found');

    const merged = { ...(restaurant.settings as Record<string, unknown>), ...settings } as any;
    return prisma.restaurant.update({
      where: { id },
      data: { settings: merged },
    });
  }

  async pauseRestaurant(id: number) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new Error('Restaurant not found');
    if (restaurant.status === 'paused') throw new Error('Restaurant is already paused');

    return prisma.restaurant.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async unpauseRestaurant(id: number) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new Error('Restaurant not found');
    if (restaurant.status === 'active') throw new Error('Restaurant is already active');

    return prisma.restaurant.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async deleteRestaurant(id: number) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new Error('Restaurant not found');

    // Prisma onDelete: Cascade handles all related data
    await prisma.restaurant.delete({ where: { id } });
    return { message: 'Restaurant and all associated data deleted permanently' };
  }

  // ─── User/Manager Management ─────────────────────────────────────────

  async getAllUsers(status?: string, search?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true, status: true } },
        otpVerification: { select: { verifiedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    if (user.status !== 'pending_approval') throw new Error('User is not pending approval');

    return prisma.user.update({
      where: { id },
      data: { status: 'active' },
      include: { restaurant: { select: { id: true, name: true } } },
    });
  }

  async rejectUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    if (user.status !== 'pending_approval') throw new Error('User is not pending approval');

    return prisma.user.update({
      where: { id },
      data: { status: 'rejected' },
      include: { restaurant: { select: { id: true, name: true } } },
    });
  }

  async suspendUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    if (user.status !== 'active') throw new Error('Only active users can be suspended');

    return prisma.user.update({
      where: { id },
      data: { status: 'suspended' },
      include: { restaurant: { select: { id: true, name: true } } },
    });
  }

  async unsuspendUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    if (user.status !== 'suspended') throw new Error('User is not suspended');

    return prisma.user.update({
      where: { id },
      data: { status: 'active' },
      include: { restaurant: { select: { id: true, name: true } } },
    });
  }

  async resetUserPassword(id: number, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  async deleteUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    await prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  // ─── Staff Management ────────────────────────────────────────────────

  async getAllStaff(restaurantId?: number, role?: string) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    if (role) where.role = role;

    return prisma.staff.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resetStaffPin(id: number, newPin: string) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new Error('Staff not found');

    const pinHash = await hashPin(newPin);
    await prisma.staff.update({
      where: { id },
      data: { pinHash },
    });

    return { message: 'PIN reset successfully' };
  }

  async toggleStaffActive(id: number) {
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new Error('Staff not found');

    return prisma.staff.update({
      where: { id },
      data: { isActive: !staff.isActive },
      include: {
        restaurant: { select: { id: true, name: true } },
      },
    });
  }

  // ─── Orders Management ───────────────────────────────────────────────

  async getAllOrders(filters: {
    restaurantId?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { restaurantId, status, startDate, endDate, page = 1, limit = 50 } = filters;
    const where: any = {};

    if (restaurantId) where.restaurantId = restaurantId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          restaurant: { select: { id: true, name: true } },
          table: { select: { id: true, tableNumber: true } },
          waiter: { select: { id: true, name: true } },
          items: {
            include: {
              menuItem: { select: { id: true, name: true, price: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async forceUpdateOrderStatus(id: number, status: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { table: true },
    });
    if (!order) throw new Error('Order not found');

    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    // If completing/cancelling, free the table
    if ((status === 'completed' || status === 'cancelled') && order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'available', currentOrderId: null },
      });
    }

    return prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        restaurant: { select: { id: true, name: true } },
        table: { select: { id: true, tableNumber: true } },
      },
    });
  }

  // ─── Bills & Payments ────────────────────────────────────────────────

  async getAllBills(filters: {
    restaurantId?: number;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const { restaurantId, paymentStatus, page = 1, limit = 50 } = filters;
    const where: any = {};

    if (restaurantId) where.restaurantId = restaurantId;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          restaurant: { select: { id: true, name: true } },
          order: {
            include: {
              table: { select: { id: true, tableNumber: true } },
              waiter: { select: { id: true, name: true } },
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getAllPayments(filters: {
    restaurantId?: number;
    page?: number;
    limit?: number;
  }) {
    const { restaurantId, page = 1, limit = 50 } = filters;
    const where: any = {};

    if (restaurantId) where.restaurantId = restaurantId;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          restaurant: { select: { id: true, name: true } },
          bill: {
            select: { id: true, billNumber: true, totalAmount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ─── Platform Analytics ──────────────────────────────────────────────

  async getPlatformAnalytics() {
    // Revenue by restaurant
    const revenueByRestaurant = await prisma.payment.groupBy({
      by: ['restaurantId'],
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: 'success' },
      orderBy: { _sum: { amount: 'desc' } },
      take: 20,
    });

    // Fetch restaurant names
    const restaurantIds = revenueByRestaurant.map((r) => r.restaurantId);
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true },
    });
    const restaurantMap = new Map(restaurants.map((r) => [r.id, r.name]));

    const revenueData = revenueByRestaurant.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: restaurantMap.get(r.restaurantId) || 'Unknown',
      revenue: Number(r._sum.amount || 0),
      transactionCount: r._count._all,
    }));

    // Orders by restaurant
    const ordersByRestaurant = await prisma.order.groupBy({
      by: ['restaurantId'],
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const ordersData = ordersByRestaurant.map((o) => ({
      restaurantId: o.restaurantId,
      restaurantName: restaurantMap.get(o.restaurantId) || 'Unknown',
      orderCount: o._count._all,
    }));

    // Payment method breakdown
    const paymentMethods = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: 'success' },
    });

    const paymentMethodData = paymentMethods.map((p) => ({
      method: p.paymentMethod,
      count: p._count._all,
      total: Number(p._sum.amount || 0),
    }));

    // Orders over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, totalAmount: true },
    });

    const dailyOrders: Record<string, { date: string; orders: number; revenue: number }> = {};
    recentOrders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!dailyOrders[dateKey]) {
        dailyOrders[dateKey] = { date: dateKey, orders: 0, revenue: 0 };
      }
      dailyOrders[dateKey].orders += 1;
      dailyOrders[dateKey].revenue += Number(order.totalAmount || 0);
    });

    const ordersOverTime = Object.values(dailyOrders).sort((a, b) => a.date.localeCompare(b.date));

    // Recent registrations (last 30 days)
    const recentRestaurants = await prisma.restaurant.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { id: true, name: true, createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      revenueByRestaurant: revenueData,
      ordersByRestaurant: ordersData,
      paymentMethodBreakdown: paymentMethodData,
      ordersOverTime,
      recentRegistrations: recentRestaurants,
    };
  }

  // ─── Pending Approvals (for Dashboard) ───────────────────────────────

  async getPendingApprovals() {
    return prisma.user.findMany({
      where: { status: 'pending_approval' },
      include: {
        restaurant: { select: { id: true, name: true, email: true, phone: true } },
        otpVerification: { select: { verifiedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

const superAdminService = new SuperAdminService();
export { superAdminService };
