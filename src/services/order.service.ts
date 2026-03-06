import prisma from '../config/database';
import type { CreateOrderInput, UpdateOrderInput, AddOrderItemsInput, UpdateOrderItemInput } from '../validators/order.validator';
import { Prisma } from "@prisma/client";

class OrderService {
  async getAllOrders(restaurantId: number) {
    return await prisma.order.findMany({
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
    });
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

  async generateOrderNumber(restaurantId: number): Promise<string> {
    const today = new Date();
    const datePrefix = `ORD${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    
    const lastOrder = await prisma.order.findFirst({
      where: {
        restaurantId,
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

  async createOrder(data: CreateOrderInput, restaurantId: number, waiterId: number) {
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

    // Calculate order totals
    let subtotal = new Prisma.Decimal(0);
    const itemsWithPrices = [];

    for (const item of data.items) {
      const menuItem = await prisma.menuItem.findFirst({
        where: {
          id: item.menuItemId,
          restaurantId,
        },
      });

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

    // Calculate tax and total
    const taxAmount = subtotal.mul(0.05); // 5% tax
    const totalAmount = subtotal.add(taxAmount);

    // Create order with items
    const order = await prisma.order.create({
      data: {
        restaurantId,
        tableId: data.tableId,
        orderNumber,
        orderType: data.orderType,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        waiterId,
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
      await prisma.table.update({
        where: { id: data.tableId },
        data: { status: 'occupied', currentOrderId: order.id },
      });
    }

    return order;
  }

  private async recalculateOrderTotals(orderId: number) {
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
    });

    let subtotal = new Prisma.Decimal(0);
    for (const item of orderItems) {
      subtotal = subtotal.add(item.subtotal);
    }

    const taxAmount = subtotal.mul(0.05);
    const totalAmount = subtotal.add(taxAmount);

    await prisma.order.update({
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

    // Validate and prepare items
    const itemsWithPrices = [];

    for (const item of data.items) {
      const menuItem = await prisma.menuItem.findFirst({
        where: {
          id: item.menuItemId,
          restaurantId,
        },
      });

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

    // Add items to order
    await prisma.orderItem.createMany({
      data: itemsWithPrices,
    });

    // Recalculate totals
    await this.recalculateOrderTotals(id);

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

    await prisma.orderItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Recalculate totals if quantity changed
    if (data.quantity) {
      await this.recalculateOrderTotals(orderId);
    }

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

    await prisma.orderItem.delete({
      where: { id: itemId },
    });

    // Recalculate totals
    await this.recalculateOrderTotals(orderId);

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

    const updatedOrder = await prisma.order.update({
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
      const activeOrders = await prisma.order.count({
        where: {
          tableId: order.tableId,
          status: {
            notIn: ['cancelled', 'completed'],
          },
        },
      });

      if (activeOrders === 0) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'available', currentOrderId: null },
        });
      }
    }

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
          in: ['pending', 'confirmed', 'preparing'],
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
