import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../config/database';
import config from '../config/env';
import { billService } from '../services/bill.service';
import { sendError, sendSuccess, sendPaginatedSuccess } from '../utils/response.util';
import { emitBillUpdate, emitOrderUpdate, emitTableStatusUpdate } from '../config/socket';
import { parseId, parsePagination } from '../utils/shared.util';
import { getErrorStatusCode } from '../utils/errors.util';
import { createBillShareToken, verifyBillShareToken } from '../utils/billShare.util';
import type { GenerateBillInput, RecordPaymentInput } from '../validators/bill.validator';

class BillController {
  private getBaseUrl(req: Request) {
    if (config.app.publicApiUrl) return config.app.publicApiUrl.replace(/\/$/, '');
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = req.get('host');
    return `${proto}://${host}`;
  }

  private buildBillPdf(res: Response, bill: any, restaurant: any, orders: any[]) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const fileName = `bill-${bill.billNumber || bill.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    const settings = restaurant?.settings || {};
    const taxPercentage = settings.taxPercentage ?? settings.tax_percentage ?? 5;
    const gstNumber = settings.gstNumber || settings.gst_number || '';

    doc.fontSize(18).text(restaurant?.name || 'Restaurant HMS', { align: 'center' });
    if (restaurant?.address) doc.fontSize(10).text(restaurant.address, { align: 'center' });
    if (restaurant?.phone) doc.fontSize(10).text(restaurant.phone, { align: 'center' });
    if (gstNumber) doc.fontSize(10).text(`GSTIN: ${gstNumber}`, { align: 'center' });

    doc.moveDown();
    doc.fontSize(12).text(`Bill #: ${bill.billNumber || 'N/A'}`);
    if (bill?.order?.table?.tableNumber) {
      doc.text(`Table: ${bill.order.table.tableNumber}`);
    }
    doc.text(`Date: ${new Date(bill.createdAt || Date.now()).toLocaleString('en-IN')}`);

    doc.moveDown();
    doc.fontSize(12).text('Items', { underline: true });

    const combinedItems = new Map<string, any>();
    for (const order of orders) {
      for (const item of order.items || []) {
        const key = String(item.menuItem?.id || item.menuItemId || item.id);
        const existing = combinedItems.get(key);
        if (existing) {
          combinedItems.set(key, {
            ...existing,
            quantity: existing.quantity + item.quantity,
            subtotal: Number(existing.subtotal) + Number(item.subtotal),
          });
        } else {
          combinedItems.set(key, { ...item });
        }
      }
    }

    for (const item of combinedItems.values()) {
      const name = item.menuItem?.name || 'Item';
      doc.fontSize(10).text(`${name}  x${item.quantity}  ₹${Number(item.subtotal).toFixed(2)}`);
    }

    doc.moveDown();
    doc.fontSize(12).text('Totals', { underline: true });
    doc.fontSize(10).text(`Subtotal: ₹${Number(bill.subtotal || 0).toFixed(2)}`);
    doc.fontSize(10).text(`Tax (${taxPercentage}%): ₹${Number(bill.taxAmount || 0).toFixed(2)}`);
    if (Number(bill.discountAmount || 0) > 0) {
      doc.text(`Discount: -₹${Number(bill.discountAmount).toFixed(2)}`);
    }
    if (Number(bill.extraCharges || 0) > 0) {
      doc.text(`Extra Charges: ₹${Number(bill.extraCharges).toFixed(2)}`);
    }
    doc.fontSize(12).text(`Grand Total: ₹${Number(bill.totalAmount || 0).toFixed(2)}`);

    doc.moveDown();
    doc.fontSize(10).text('*** Thank You for Visiting ***', { align: 'center' });
    doc.fontSize(10).text('Please Come Again!', { align: 'center' });

    doc.end();
  }
  async getBills(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const paymentStatus = req.query.paymentStatus as string | undefined;
      const { page, limit, skip } = parsePagination(req);
      const { data, total } = await billService.getBills(user.restaurantId, paymentStatus, skip, limit);
      return sendPaginatedSuccess(res, data, total, page, limit, 'Bills retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getBillById(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const id = parseId(req.params.id);
      const bill = await billService.getBillById(id, user.restaurantId);
      return sendSuccess(res, bill, 'Bill retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, getErrorStatusCode(error, 500));
    }
  }

  async getBillByOrderId(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const orderId = parseId(req.params.orderId);
      const bill = await billService.getBillByOrderId(orderId, user.restaurantId);
      return sendSuccess(res, bill, 'Bill retrieved successfully');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendSuccess(res, null, 'Bill not generated yet');
      }
      return sendError(res, error.message, 500);
    }
  }

  async generateBill(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const orderId = parseId(req.params.orderId);
      const payload: GenerateBillInput = req.body;
      const bill = await billService.generateBill(orderId, user.restaurantId, payload);

      // Emit real-time socket events
      emitBillUpdate(user.restaurantId, bill);
      if (bill.order) {
        emitOrderUpdate(user.restaurantId, bill.order);
      }
      if (bill.order?.tableId) {
        emitTableStatusUpdate(user.restaurantId, { event: 'status_changed', table: bill.order.table });
      }

      return sendSuccess(res, bill, 'Bill generated successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async recordPayment(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const billId = parseId(req.params.id);
      const payload: RecordPaymentInput = req.body;
      const result = await billService.recordPayment(billId, user.restaurantId, payload);

      // Emit real-time socket events
      emitBillUpdate(user.restaurantId, result.bill);
      if (result.bill.order) {
        emitOrderUpdate(user.restaurantId, result.bill.order);
      }
      if (result.bill.order?.tableId) {
        emitTableStatusUpdate(user.restaurantId, { event: 'status_changed', tableId: result.bill.order.tableId });
      }

      return sendSuccess(res, result, 'Payment recorded successfully');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async createShareLink(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const billId = parseId(req.params.id);
      const bill = await billService.getBillById(billId, user.restaurantId);

      const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
      const token = createBillShareToken({
        billId,
        restaurantId: user.restaurantId,
        exp: expiresAt,
      });

      const baseUrl = this.getBaseUrl(req);
      const url = `${baseUrl}/api/v1/bills/${billId}/download?token=${encodeURIComponent(token)}`;

      return sendSuccess(res, { url, expiresAt, billNumber: bill.billNumber }, 'Share link created');
    } catch (error: any) {
      return sendError(res, error.message, getErrorStatusCode(error, 400));
    }
  }

  async downloadBillPdf(req: Request, res: Response) {
    try {
      const billId = parseId(req.params.id);
      const token = String(req.query.token || '');
      const payload = verifyBillShareToken(token);

      if (!payload || payload.billId !== billId) {
        return sendError(res, 'Invalid or expired link', 400);
      }
      if (payload.exp < Date.now()) {
        return sendError(res, 'Link expired', 410);
      }

      const bill = await billService.getBillById(billId, payload.restaurantId);
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: payload.restaurantId },
        select: { name: true, phone: true, address: true, settings: true },
      });

      const consolidatedOrders = (bill as any).consolidatedOrders || [];
      let orders = consolidatedOrders.length > 0 ? consolidatedOrders : [bill.order];

      if (orders.length === 0 && bill.order?.tableId) {
        orders = await prisma.order.findMany({
          where: {
            tableId: bill.order.tableId,
            restaurantId: payload.restaurantId,
            status: { in: ['billing', 'completed'] },
            createdAt: { lte: bill.createdAt },
          },
          include: { items: { include: { menuItem: true } } },
        });
      }

      this.buildBillPdf(res, bill, restaurant, orders);
    } catch (error: any) {
      return sendError(res, error.message, getErrorStatusCode(error, 500));
    }
  }
}

export default new BillController();
