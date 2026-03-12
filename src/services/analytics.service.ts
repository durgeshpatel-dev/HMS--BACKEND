import prisma from '../config/database';

class AnalyticsService {
  /**
   * Get sales analytics for a date range
   */
  async getSalesAnalytics(
    restaurantId: number,
    startDate?: Date,
    endDate?: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ) {
    const query: any = { restaurantId, status: 'completed' };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.gte = startDate;
      if (endDate) query.createdAt.lte = endDate;
    }

    const orders = await prisma.order.findMany({
      where: query,
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        items: {
          select: { quantity: true },
        },
      },
    });

    // Group by date
    const grouped: Record<string, any> = {};

    orders.forEach((order) => {
      let key: string;

      if (groupBy === 'day') {
        key = order.createdAt.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const date = new Date(order.createdAt);
        const week = Math.floor((date.getDate() - date.getDay() + 6) / 7);
        key = `Week ${week} ${date.toLocaleString('default', { month: 'short' })}`;
      } else {
        // month
        key = order.createdAt.toLocaleString('default', { month: 'long', year: 'numeric' });
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          sales: 0,
          orders: 0,
          items: 0,
        };
      }

      grouped[key].sales += Number(order.totalAmount || 0);
      grouped[key].orders += 1;
      grouped[key].items += order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    });

    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }

  /**
   * Get top selling items
   */
  async getTopItems(restaurantId: number, limit: number = 10, startDate?: Date, endDate?: Date) {
    const query: any = { restaurant: { id: restaurantId }, order: { status: 'completed' } };

    if (startDate || endDate) {
      query.order.createdAt = {};
      if (startDate) query.order.createdAt.gte = startDate;
      if (endDate) query.order.createdAt.lte = endDate;
    }

    const itemStats = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: query,
      _sum: {
        quantity: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    // Fetch menu item details
    const itemIds = itemStats.map((stat) => stat.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurantId },
      select: { id: true, name: true, price: true },
    });

    return itemStats.map((stat) => {
      const menuItem = menuItems.find((m) => m.id === stat.menuItemId);
      return {
        itemId: stat.menuItemId,
        itemName: menuItem?.name || 'Unknown Item',
        quantity: stat._sum.quantity || 0,
        revenue: Number(stat._sum.subtotal || 0),
        unitPrice: menuItem?.price || 0,
      };
    });
  }

  /**
   * Get order summary (total orders, revenue, avg order value)
   */
  async getOrderSummary(restaurantId: number, startDate?: Date, endDate?: Date) {
    const query: any = { restaurantId, status: 'completed' };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.gte = startDate;
      if (endDate) query.createdAt.lte = endDate;
    }

    const orders = await prisma.order.findMany({
      where: query,
      select: {
        totalAmount: true,
        items: {
          select: { quantity: true },
        },
      },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      totalItems,
      avgOrderValue,
    };
  }

  /**
   * Get payment method breakdown
   */
  async getPaymentMethodBreakdown(restaurantId: number, startDate?: Date, endDate?: Date) {
    const query: any = { restaurantId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.gte = startDate;
      if (endDate) query.createdAt.lte = endDate;
    }

    const payments = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: query as any,
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    });

    return payments.map((payment) => ({
      method: payment.paymentMethod || 'Unknown',
      count: payment._count._all,
      total: Number(payment._sum.amount || 0),
    }));
  }

  /**
   * Get waiter performance (by staff member)
   */
  async getWaiterPerformance(restaurantId: number, startDate?: Date, endDate?: Date, limit: number = 10) {
    const query: any = { restaurantId, status: 'completed' };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.gte = startDate;
      if (endDate) query.createdAt.lte = endDate;
    }

    const staffStats = await prisma.order.groupBy({
      by: ['waiterId'],
      where: query,
      _count: true,
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: limit,
    });

    // Fetch staff details
    const staffIds = staffStats.map((stat) => stat.waiterId).filter((id) => id !== null);
    const staff = await prisma.staff.findMany({
      where: { id: { in: staffIds as number[] } },
      select: { id: true, name: true },
    });

    return staffStats.map((stat) => {
      const staffMember = staff.find((s) => s.id === stat.waiterId);
      return {
        staffId: stat.waiterId,
        staffName: staffMember?.name || 'Unknown',
        ordersCount: stat._count,
        totalRevenue: Number(stat._sum.totalAmount || 0),
        avgOrderValue: stat._count > 0 ? Number(stat._sum.totalAmount || 0) / stat._count : 0,
      };
    });
  }
}

const analyticsService = new AnalyticsService();
export { analyticsService };
