import prisma from '../config/database';
import type { CreateTableInput, UpdateTableInput, UpdateTableStatusInput } from '../validators/table.validator';

class TableService {
  async getAllTables(restaurantId: number) {
    return await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
    });
  }

  async getTableById(id: number, restaurantId: number) {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
      include: {
        orders: {
          where: {
            status: {
              in: ['pending', 'preparing', 'ready', 'billing'],
            },
          },
          include: {
            items: {
              include: {
                menuItem: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!table) {
      throw new Error('Table not found');
    }

    // Compute consolidated summary across all active orders
    const pendingBillSummary = {
      orderCount: table.orders.length,
      combinedSubtotal: table.orders.reduce((sum, o) => sum + Number(o.subtotal), 0),
      combinedTaxAmount: table.orders.reduce((sum, o) => sum + Number(o.taxAmount), 0),
      combinedDiscountAmount: table.orders.reduce((sum, o) => sum + Number(o.discountAmount), 0),
      combinedTotal: table.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
    };

    return { ...table, pendingBillSummary };
  }

  async getTableByNumber(tableNumber: string, restaurantId: number) {
    return await prisma.table.findFirst({
      where: { tableNumber, restaurantId },
    });
  }

  async createTable(data: CreateTableInput, restaurantId: number) {
    // Check if table number already exists
    const existingTable = await this.getTableByNumber(data.tableNumber, restaurantId);
    if (existingTable) {
      throw new Error('Table number already exists');
    }

    return await prisma.table.create({
      data: {
        ...data,
        restaurantId,
        status: 'available',
      },
    });
  }

  async updateTable(id: number, data: UpdateTableInput, restaurantId: number) {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
    });

    if (!table) {
      throw new Error('Table not found');
    }

    // If updating table number, check uniqueness
    if (data.tableNumber && data.tableNumber !== table.tableNumber) {
      const existingTable = await this.getTableByNumber(data.tableNumber, restaurantId);
      if (existingTable) {
        throw new Error('Table number already exists');
      }
    }

    return await prisma.table.update({
      where: { id },
      data,
    });
  }

  async updateTableStatus(id: number, data: UpdateTableStatusInput, restaurantId: number) {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
    });

    if (!table) {
      throw new Error('Table not found');
    }

    return await prisma.table.update({
      where: { id },
      data: { status: data.status },
    });
  }

  async deleteTable(id: number, restaurantId: number) {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
    });

    if (!table) {
      throw new Error('Table not found');
    }

    // Check if table has active orders
    const activeOrders = await prisma.order.count({
      where: {
        tableId: id,
        status: {
          in: ['pending', 'preparing', 'ready'],
        },
      },
    });

    if (activeOrders > 0) {
      throw new Error('Cannot delete table with active orders');
    }

    await prisma.table.delete({
      where: { id },
    });

    return { message: 'Table deleted successfully' };
  }

  async getAvailableTables(restaurantId: number) {
    return await prisma.table.findMany({
      where: {
        restaurantId,
        status: 'available',
      },
      orderBy: { tableNumber: 'asc' },
    });
  }

  async getTableStats(restaurantId: number) {
    const tables = await prisma.table.findMany({
      where: { restaurantId },
    });

    const stats = {
      total: tables.length,
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
      cleaning: tables.filter(t => t.status === 'cleaning').length,
    };

    return stats;
  }
}

const tableService = new TableService();
export { tableService };

