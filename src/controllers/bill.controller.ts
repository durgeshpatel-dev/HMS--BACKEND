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

// Standalone helpers (not class methods) so Express route handlers don't lose `this` context
function getBaseUrl(req: Request) {
  if (config.app.publicApiUrl) return config.app.publicApiUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}`;
}

function buildBillPdf(res: Response, bill: any, restaurant: any, orders: any[]) {
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

  // Use A4 for a premium/professional look and let PDFKit paginate as needed
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const fileName = `bill-${bill.billNumber || bill.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  doc.pipe(res);

  const settings = restaurant?.settings || {};
  const taxPercentage = settings.taxPercentage ?? settings.tax_percentage ?? 5;
  const gstNumber = settings.gstNumber || settings.gst_number || '';

  // Layout measurements
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colItem = Math.round(pageWidth * 0.55);
  const colQty = Math.round(pageWidth * 0.10);
  const colRate = Math.round(pageWidth * 0.15);
  const colAmount = pageWidth - (colItem + colQty + colRate);

  // Header
  doc.font('Helvetica-Bold').fontSize(20).text(restaurant?.name || 'Restaurant HMS', { align: 'left' });
  doc.moveUp();
  doc.font('Helvetica').fontSize(10);
  if (restaurant?.address) doc.text(restaurant.address, { align: 'left' });
  if (restaurant?.phone) doc.text(`Phone: ${restaurant.phone}`, { align: 'left' });
  if (gstNumber) doc.text(`GSTIN: ${gstNumber}`, { align: 'left' });

  // Bill meta on the right
  const metaX = doc.page.margins.left + pageWidth - 200;
  const metaY = doc.page.margins.top;
  doc.font('Helvetica-Bold').fontSize(10).text(`Bill #: ${bill.billNumber || 'N/A'}`, metaX, metaY, { align: 'right' });
  const tableOrParcel = bill?.order?.table?.tableNumber ? `Table: ${bill.order.table.tableNumber}` : 'Parcel';
  doc.font('Helvetica').fontSize(10).text(tableOrParcel, metaX, metaY + 14, { align: 'right' });
  doc.text(`Date: ${new Date(bill.createdAt || Date.now()).toLocaleString('en-IN')}`, metaX, metaY + 28, { align: 'right' });

  doc.moveDown(1.5);
  doc.lineWidth(1).dash(2, { space: 2 }).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke();
  doc.undash();
  doc.moveDown(0.5);

  // Items header
  doc.font('Helvetica-Bold').fontSize(11);
  const startX = doc.page.margins.left;
  let y = doc.y;
  doc.text('Item', startX, y, { width: colItem });
  doc.text('Qty', startX + colItem, y, { width: colQty, align: 'center' });
  doc.text('Rate', startX + colItem + colQty, y, { width: colRate, align: 'right' });
  doc.text('Amount', startX + colItem + colQty + colRate, y, { width: colAmount, align: 'right' });

  doc.moveDown(0.3);
  doc.lineWidth(0.5).moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).stroke();
  doc.moveDown(0.5);

  // Items rows
  doc.font('Helvetica').fontSize(10);
  for (const item of combinedItems.values()) {
    const name = item.menuItem?.name || item.name || 'Item';
    const qty = Number(item.quantity || 1);
    const amt = Number(item.subtotal || 0);
    const rate = qty ? (amt / qty) : amt;

    // Paginate if near bottom
    if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
    }

    const rowY = doc.y;
    doc.text(name, startX, rowY, { width: colItem });
    doc.text(String(qty), startX + colItem, rowY, { width: colQty, align: 'center' });
    doc.text(`Rs ${rate.toFixed(2)}`, startX + colItem + colQty, rowY, { width: colRate, align: 'right' });
    doc.text(`Rs ${amt.toFixed(2)}`, startX + colItem + colQty + colRate, rowY, { width: colAmount, align: 'right' });

    // allow wrapped name lines to increase spacing
    const afterY = doc.y;
    if (afterY === rowY) doc.moveDown(0.6); else doc.moveTo(startX, afterY);
  }

  doc.moveDown(0.5);
  doc.lineWidth(0.5).moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).stroke();
  doc.moveDown(0.5);

  // Totals (right-aligned block)
  const rightColX = startX + colItem + colQty + colRate;
  doc.font('Helvetica').fontSize(10);
  doc.text('Subtotal:', rightColX - 120, doc.y, { continued: true });
  doc.text(`Rs ${Number(bill.subtotal || 0).toFixed(2)}`, { align: 'right' });

  if (Number(bill.taxAmount || 0) > 0) {
    doc.text(`Tax (${taxPercentage}%):`, rightColX - 120, doc.y, { continued: true });
    doc.text(`Rs ${Number(bill.taxAmount).toFixed(2)}`, { align: 'right' });
  }

  if (Number(bill.discountAmount || 0) > 0) {
    const dPct = bill.discountPercentage ? ` (${Number(bill.discountPercentage).toFixed(1)}%)` : '';
    doc.text(`Discount${dPct}:`, rightColX - 120, doc.y, { continued: true });
    doc.text(`-Rs ${Number(bill.discountAmount).toFixed(2)}`, { align: 'right' });
  }

  if (Number(bill.extraCharges || 0) > 0) {
    doc.text('Extra Charges:', rightColX - 120, doc.y, { continued: true });
    doc.text(`Rs ${Number(bill.extraCharges).toFixed(2)}`, { align: 'right' });
  }

  doc.moveDown(0.5);
  doc.lineWidth(0.8).moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).stroke();
  doc.moveDown(0.5);

  // Grand Total emphasized
  doc.font('Helvetica-Bold').fontSize(14);
  doc.text('GRAND TOTAL', startX, doc.y, { continued: true });
  doc.text(`Rs ${Number(bill.totalAmount || 0).toFixed(2)}`, { align: 'right' });

  doc.moveDown(1);

  // Footer
  doc.font('Helvetica').fontSize(10).text('*** Thank You for Dining with Us ***', { align: 'center' });
  if (restaurant?.website) doc.text(restaurant.website, { align: 'center' });
  if (restaurant?.email) doc.text(restaurant.email, { align: 'center' });

  doc.end();
}

class BillController {

  // buildBillPdf and getBaseUrl moved to module-level standalone functions above
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

      const baseUrl = getBaseUrl(req);
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

      buildBillPdf(res, bill, restaurant, orders);
    } catch (error: any) {
      return sendError(res, error.message, getErrorStatusCode(error, 500));
    }
  }
}

export default new BillController();
