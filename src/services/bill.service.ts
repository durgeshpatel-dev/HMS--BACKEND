import prisma from '../config/database';
import { calculateOrderTotals, generateBillNumber } from '../utils/helpers.util';
import type { GenerateBillInput, RecordPaymentInput } from '../validators/bill.validator';

class BillService {
  private async getTaxPercentage(restaurantId: number): Promise<number> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { settings: true },
    });

    const settings = restaurant?.settings as any;
    const taxPercentage = Number(settings?.tax_percentage ?? 5);
    return Number.isFinite(taxPercentage) ? taxPercentage : 5;
  }

  async getBills(restaurantId: number, paymentStatus?: string) {
    return await prisma.bill.findMany({
      where: {
        restaurantId,
        ...(paymentStatus ? { paymentStatus } : {}),
      },
      include: {
        order: {
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
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBillById(id: number, restaurantId: number) {
    const bill = await prisma.bill.findFirst({
      where: { id, restaurantId },
      include: {
        order: {
          include: {
            items: {
              include: {
                menuItem: true,
              },
            },
            table: true,
            waiter: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!bill) throw new Error('Bill not found');

    // Include all billing-status sibling orders for the same table
    const consolidatedOrders = bill.order.tableId
      ? await prisma.order.findMany({
          where: {
            tableId: bill.order.tableId,
            restaurantId,
            status: 'billing',
          },
          include: {
            items: { include: { menuItem: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [bill.order];

    return { ...bill, consolidatedOrders };
  }

  async getBillByOrderId(orderId: number, restaurantId: number) {
    // First try to find bill directly by orderId
    let bill = await prisma.bill.findFirst({
      where: { orderId, restaurantId },
      include: {
        order: {
          include: {
            items: { include: { menuItem: true } },
            table: true,
          },
        },
        payments: true,
      },
    });

    // If not found, the order may be a sibling consolidated into another order's bill
    if (!bill) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, restaurantId },
        select: { tableId: true, status: true },
      });

      if (order?.tableId && order.status === 'billing') {
        bill = await prisma.bill.findFirst({
          where: {
            restaurantId,
            order: { tableId: order.tableId, status: 'billing' },
          },
          include: {
            order: {
              include: {
                items: { include: { menuItem: true } },
                table: true,
              },
            },
            payments: true,
          },
        });
      }
    }

    if (!bill) throw new Error('Bill not found for this order');

    // Include all billing-status sibling orders for the same table
    const consolidatedOrders = bill.order.tableId
      ? await prisma.order.findMany({
          where: {
            tableId: bill.order.tableId,
            restaurantId,
            status: 'billing',
          },
          include: {
            items: { include: { menuItem: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [bill.order];

    return { ...bill, consolidatedOrders };
  }

  async generateBill(orderId: number, restaurantId: number, payload?: GenerateBillInput) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: true,
        table: true,
        bill: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.items.length) {
      throw new Error('Cannot generate bill for an order without items');
    }

    // Find all other unbilled orders for the same table
    const siblingOrders = order.tableId
      ? await prisma.order.findMany({
          where: {
            tableId: order.tableId,
            restaurantId,
            id: { not: order.id },
            status: { notIn: ['completed', 'cancelled'] },
            bill: null,
          },
          include: { items: true },
        })
      : [];

    const allOrders = [order, ...siblingOrders];

    const discountAmount = Number(payload?.discountAmount ?? order.discountAmount ?? 0);

    // Calculate combined subtotal from ALL unbilled orders for this table
    const combinedSubtotal = allOrders.reduce(
      (total, o) => total + o.items.reduce((sum, item) => sum + Number(item.subtotal), 0),
      0,
    );

    const taxPercentage = await this.getTaxPercentage(restaurantId);
    const totals = calculateOrderTotals(combinedSubtotal, taxPercentage, discountAmount);

    const bill = await prisma.$transaction(async (tx) => {
      // Mark all sibling unbilled orders as 'billing'
      if (siblingOrders.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: siblingOrders.map((o) => o.id) } },
          data: { status: 'billing' },
        });
      }

      // Update primary order with combined totals and set to billing
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'billing',
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
        },
      });

      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: {
            status: 'billing',
            currentOrderId: order.id,
          },
        });
      }

      if (order.bill) {
        return await tx.bill.update({
          where: { id: order.bill.id },
          data: {
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            discountAmount: totals.discountAmount,
            totalAmount: totals.totalAmount,
          },
          include: {
            order: {
              include: {
                table: true,
                items: { include: { menuItem: true } },
              },
            },
            payments: true,
          },
        });
      }

      return await tx.bill.create({
        data: {
          restaurantId,
          orderId: order.id,
          billNumber: generateBillNumber(),
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          paymentStatus: 'unpaid',
        },
        include: {
          order: {
            include: {
              table: true,
              items: { include: { menuItem: true } },
            },
          },
          payments: true,
        },
      });
    });

    // Fetch all billing orders for this table to include in response
    const consolidatedOrders = order.tableId
      ? await prisma.order.findMany({
          where: {
            tableId: order.tableId,
            restaurantId,
            status: 'billing',
          },
          include: {
            items: { include: { menuItem: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : allOrders;

    return { ...bill, consolidatedOrders };
  }

  async recordPayment(billId: number, restaurantId: number, payload: RecordPaymentInput) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, restaurantId },
      include: {
        order: true,
        payments: true,
      },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    const alreadyPaid = bill.payments
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const remainingAmount = Math.max(0, Number(bill.totalAmount) - alreadyPaid);
    const amount = Number(payload.amount ?? remainingAmount);

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          restaurantId,
          billId,
          amount,
          paymentMethod: payload.paymentMethod,
          transactionId: payload.transactionId,
          status: payload.status ?? 'success',
        },
      });

      const successfulPayments = await tx.payment.findMany({
        where: {
          billId,
          status: 'success',
        },
      });

      const totalPaid = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const paymentStatus = totalPaid >= Number(bill.totalAmount) ? 'paid' : 'partial';

      const updatedBill = await tx.bill.update({
        where: { id: billId },
        data: { paymentStatus },
        include: {
          order: true,
          payments: true,
        },
      });

      if (paymentStatus === 'paid') {
        if (bill.order.tableId) {
          // Mark ALL billing-status orders for this table as completed
          await tx.order.updateMany({
            where: {
              tableId: bill.order.tableId,
              restaurantId: bill.restaurantId,
              status: 'billing',
            },
            data: {
              status: 'completed',
              completedAt: new Date(),
            },
          });

          await tx.table.update({
            where: { id: bill.order.tableId },
            data: {
              status: 'available',
              currentOrderId: null,
            },
          });
        } else {
          await tx.order.update({
            where: { id: bill.orderId },
            data: {
              status: 'completed',
              completedAt: new Date(),
            },
          });
        }
      }

      return { bill: updatedBill, payment };
    });

    return result;
  }
}

export const billService = new BillService();
