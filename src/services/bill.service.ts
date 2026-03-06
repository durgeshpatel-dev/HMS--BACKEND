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
    return bill;
  }

  async getBillByOrderId(orderId: number, restaurantId: number) {
    const bill = await prisma.bill.findFirst({
      where: { orderId, restaurantId },
      include: {
        order: {
          include: {
            items: {
              include: {
                menuItem: true,
              },
            },
            table: true,
          },
        },
        payments: true,
      },
    });

    if (!bill) throw new Error('Bill not found for this order');
    return bill;
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

    const discountAmount = Number(payload?.discountAmount ?? order.discountAmount ?? 0);
    const subtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const taxPercentage = await this.getTaxPercentage(restaurantId);
    const totals = calculateOrderTotals(subtotal, taxPercentage, discountAmount);

    const bill = await prisma.$transaction(async (tx) => {
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
                items: {
                  include: {
                    menuItem: true,
                  },
                },
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
              items: {
                include: {
                  menuItem: true,
                },
              },
            },
          },
          payments: true,
        },
      });
    });

    return bill;
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
        await tx.order.update({
          where: { id: bill.orderId },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });

        if (bill.order.tableId) {
          await tx.table.update({
            where: { id: bill.order.tableId },
            data: {
              status: 'available',
              currentOrderId: null,
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
