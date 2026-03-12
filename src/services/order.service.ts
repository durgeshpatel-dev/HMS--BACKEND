import prisma from '../config/database';
import type { CreateOrderInput, UpdateOrderInput, AddOrderItemsInput, UpdateOrderItemInput } from '../validators/order.validator';
import { Prisma } from "@prisma/client";
import { getTaxRateDecimal } from '../utils/shared.util';

class OrderService {
  async getAllOrders(restaurantId: number, skip = 0, take = 50) {
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where: { restaurantId },
        include: {
          table: {
            select: {
              id: true,
              tableNumber: true,
            },
          },
          waiter: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: { restaurantId } }),
    ]);
    return { data, total };
  }

  async getOrderById(id: number, restaurantId: number) {
    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: {
        table: true,
        waiter: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  // Tax rate fetched via shared utility: getTaxRateDecimal()

  async generateOrderNumber(restaurantId: number): Promise<string> {
    const today = new Date();
    const datePrefix = `ORD${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    
    // Query across ALL restaurants since order_number has a global unique constraint
    const lastOrder = await prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: datePrefix,
        },
      },
      orderBy: { orderNumber: 'desc' },
    });

    if (!lastOrder) {
      return `${datePrefix}-001`;
    }

    const lastNumber = parseInt(lastOrder.orderNumber.split('-')[1]);
    const newNumber = (lastNumber + 1).toString().padStart(3, '0');
    return `${datePrefix}-${newNumber}`;
  }

  async createOrder(data: CreateOrderInput, restaurantId: number, waiterId?: number, createdByManager: boolean = false) {
    // Verify table exists and belongs to restaurant
    if (data.tableId) {
      const table = await prisma.table.findFirst({
        where: {
          id: data.tableId,
          restaurantId,
        },
      });

      if (!table) {
        throw new Error('Table not found or does not belong to this restaurant');
      }
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber(restaurantId);

    // Calculate order totals — batch-fetch all menu items in one query (avoids N+1)
    const menuItemIds = data.items.map((item) => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
    });
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    let subtotal = new Prisma.Decimal(0);
    const itemsWithPrices = [];

    for (const item of data.items) {
      const menuItem = menuItemMap.get(item.menuItemId);

      if (!menuItem) {
        throw new Error(`Menu item ${item.menuItemId} not found`);
      }

      if (!menuItem.isAvailable) {
        throw new Error(`Menu item ${menuItem.name} is not available`);
      }

      const itemSubtotal = menuItem.price.mul(item.quantity);
      subtotal = subtotal.add(itemSubtotal);

      itemsWithPrices.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        subtotal: itemSubtotal,
        customizations: item.customizations || {},
        restaurantId,
      });
    }

    // Calculate tax and total using restaurant's configured tax rate
    const taxRate = await getTaxRateDecimal(restaurantId);
    const taxAmount = subtotal.mul(taxRate);
    const totalAmount = subtotal.add(taxAmount);

    // Create order with items + update table atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          restaurantId,
          tableId: data.tableId,
          orderNumber,
          orderType: data.orderType,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          waiterId,
          status: createdByManager ? 'preparing' : 'pending',
          kitchenStatus: createdByManager ? 'preparing' : 'pending',
          subtotal,
          taxAmount,
          totalAmount,
          specialNotes: data.specialNotes,
          items: {
            create: itemsWithPrices,
          },
        },
        include: {
          table: true,
          waiter: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });

      // Update table status to occupied if dine-in
      if (data.tableId && data.orderType === 'dine_in') {
        await tx.table.update({
          where: { id: data.tableId },
          data: { status: 'occupied', currentOrderId: created.id },
        });
      }

      return created;
    }, { timeout: 15000 });

    return order;
  }

  private async recalculateOrderTotals(orderId: number, tx: Prisma.TransactionClient = prisma) {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId },
    });

    // Get restaurantId from the order so we can read the correct tax rate
    const orderRecord = await tx.order.findUnique({
      where: { id: orderId },
      select: { restaurantId: true },
    });

    let subtotal = new Prisma.Decimal(0);
    for (const item of orderItems) {
      subtotal = subtotal.add(item.subtotal);
    }

    const taxRate = orderRecord
      ? await getTaxRateDecimal(orderRecord.restaurantId, tx)
      : new Prisma.Decimal(0.05);
    const taxAmount = subtotal.mul(taxRate);
    const totalAmount = subtotal.add(taxAmount);

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        taxAmount,
        totalAmount,
      },
    });
  }

  async updateOrder(id: number, data: UpdateOrderInput, restaurantId: number) {
    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Don't allow updates to cancelled or completed orders
    if (order.status === 'cancelled' || order.status === 'completed') {
      throw new Error('Cannot update cancelled or completed orders');
    }

    const updateData: any = { ...data };
    
    if (data.status === 'completed') {
      updateData.completedAt = new Date();
    }

    // Keep status and kitchenStatus in sync
    // Map: status → kitchenStatus
    const statusToKitchen: Record<string, string> = {
      pending: 'pending',
      confirmed: 'pending',
      preparing: 'preparing',
      ready: 'ready',
      served: 'ready',
      billing: 'ready',
      completed: 'ready',
    };
    // Map: kitchenStatus → status (only move forward, never backwards)
    const kitchenToStatus: Record<string, string> = {
      preparing: 'preparing',
      ready: 'ready',
    };

    if (data.status && !data.kitchenStatus && statusToKitchen[data.status]) {
      updateData.kitchenStatus = statusToKitchen[data.status];
    }
    if (data.kitchenStatus && !data.status && kitchenToStatus[data.kitchenStatus]) {
      // Only advance the main status if the order is still in a kitchen-relevant state
      const kitchenStatuses = ['pending', 'confirmed', 'preparing'];
      if (kitchenStatuses.includes(order.status)) {
        updateData.status = kitchenToStatus[data.kitchenStatus];
      }
    }

    return await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        table: true,
        waiter: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });
  }

  async addOrderItems(id: number, data: AddOrderItemsInput, restaurantId: number) {
    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      throw new Error('Cannot add items to cancelled or completed orders');
    }

    // Validate and prepare items — batch-fetch all menu items in one query (avoids N+1)
    const addMenuItemIds = data.items.map((item) => item.menuItemId);
    const addMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: addMenuItemIds }, restaurantId },
    });
    const addMenuItemMap = new Map(addMenuItems.map((m) => [m.id, m]));

    const itemsWithPrices = [];

    for (const item of data.items) {
      const menuItem = addMenuItemMap.get(item.menuItemId);

      if (!menuItem) {
        throw new Error(`Menu item ${item.menuItemId} not found`);
      }

      if (!menuItem.isAvailable) {
        throw new Error(`Menu item ${menuItem.name} is not available`);
      }

      const itemSubtotal = menuItem.price.mul(item.quantity);

      itemsWithPrices.push({
        orderId: id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        subtotal: itemSubtotal,
        customizations: item.customizations || {},
        restaurantId,
      });
    }

    // Add items and recalculate totals atomically
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({
        data: itemsWithPrices,
      });

      await this.recalculateOrderTotals(id, tx);
    }, { timeout: 15000 });

    // Return updated order
    return await this.getOrderById(id, restaurantId);
  }

  async updateOrderItem(orderId: number, itemId: number, data: UpdateOrderItemInput, restaurantId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
    });

    if (!orderItem) {
      throw new Error('Order item not found');
    }

    const updateData: any = {};
    
    if (data.quantity) {
      updateData.quantity = data.quantity;
      updateData.subtotal = orderItem.unitPrice.mul(data.quantity);
    }

    if (data.customizations !== undefined) {
      updateData.customizations = data.customizations;
    }

    // Update item and recalculate totals atomically
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: updateData,
      });

      if (data.quantity) {
        await this.recalculateOrderTotals(orderId, tx);
      }
    }, { timeout: 15000 });

    return await this.getOrderById(orderId, restaurantId);
  }

  async deleteOrderItem(orderId: number, itemId: number, restaurantId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.items.length === 1) {
      throw new Error('Cannot delete the last item. Cancel the order instead.');
    }

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
    });

    if (!orderItem) {
      throw new Error('Order item not found');
    }

    // Delete item and recalculate totals atomically
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({
        where: { id: itemId },
      });

      await this.recalculateOrderTotals(orderId, tx);
    }, { timeout: 15000 });

    return await this.getOrderById(orderId, restaurantId);
  }

  async cancelOrder(id: number, restaurantId: number) {
    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: {
        table: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'completed') {
      throw new Error('Cannot cancel completed orders');
    }

    // Cancel order and free table atomically
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.update({
        where: { id },
        data: {
          status: 'cancelled',
        },
        include: {
          table: true,
          waiter: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });

      // If table was occupied, update its status
      if (order.tableId) {
        const activeOrders = await tx.order.count({
          where: {
            tableId: order.tableId,
            status: {
              notIn: ['cancelled', 'completed'],
            },
          },
        });

        if (activeOrders === 0) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: 'available', currentOrderId: null },
          });
        }
      }

      return cancelled;
    }, { timeout: 15000 });

    return updatedOrder;
  }

  async getOrdersByWaiter(waiterId: number, restaurantId: number) {
    return await prisma.order.findMany({
      where: {
        restaurantId,
        waiterId,
        status: {
          notIn: ['cancelled', 'completed'],
        },
      },
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getKitchenOrders(restaurantId: number) {
    return await prisma.order.findMany({
      where: {
        restaurantId,
        status: {
          in: ['pending', 'confirmed', 'preparing', 'ready'],
        },
      },
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
          },
        },
        waiter: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

const orderService = new OrderService();
export { orderService };
