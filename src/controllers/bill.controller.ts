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

  const settings = restaurant?.settings || {};
  const taxPercentage = settings.taxPercentage ?? settings.tax_percentage ?? 5;
  const gstNumber = settings.gstNumber || settings.gst_number || '';
  const tableOrParcel = bill?.order?.table?.tableNumber ? `Table: ${bill.order.table.tableNumber}` : 'Parcel Order';
  const restName = restaurant?.name || 'Restaurant HMS';

  // ── Dynamic page height so small orders don't have massive empty space ──
  const itemCount = combinedItems.size;
  const hasDiscount = Number(bill.discountAmount || 0) > 0;
  const hasTax = Number(bill.taxAmount || 0) > 0;
  const hasExtra = Number(bill.extraCharges || 0) > 0;
  const totalsLines = 1 + (hasTax ? 1 : 0) + (hasDiscount ? 1 : 0) + (hasExtra ? 1 : 0);
  // Header ~160  +  items section ~(30 per item + 60 header)  +  totals ~(25*lines + 70 grand total)  +  footer ~100  +  padding 80
  const estimatedHeight = 160 + (itemCount * 32 + 70) + (totalsLines * 25 + 80) + 110 + 80;
  const minHeight = 500; // never shorter than this
  const pageHeight = Math.max(minHeight, Math.min(estimatedHeight, 841.89)); // cap at A4

  const margin = 50;
  const doc = new PDFDocument({ size: [595.28, pageHeight], margin });

  const fileName = `bill-${bill.billNumber || bill.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - margin * 2;
  const startX = margin;

  // ━━━━━━━━━━━━━━━━━━━━  HEADER  ━━━━━━━━━━━━━━━━━━━━

  // Top accent bar
  doc.save();
  doc.rect(0, 0, doc.page.width, 6).fill('#1a1a2e');
  doc.restore();

  // Restaurant name — centered, large
  const headerY = margin + 10;
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a1a2e')
    .text(restName.toUpperCase(), startX, headerY, { align: 'center', width: pageWidth });

  // Decorative line under name
  doc.moveDown(0.3);
  const decoY = doc.y;
  const decoCenter = startX + pageWidth / 2;
  doc.lineWidth(0.5).strokeColor('#cccccc')
    .moveTo(decoCenter - 120, decoY).lineTo(decoCenter - 15, decoY).stroke();
  doc.lineWidth(0.5).strokeColor('#cccccc')
    .moveTo(decoCenter + 15, decoY).lineTo(decoCenter + 120, decoY).stroke();
  // small diamond in center
  doc.save();
  doc.fillColor('#1a1a2e');
  doc.path(`M${decoCenter},${decoY - 4} L${decoCenter + 4},${decoY} L${decoCenter},${decoY + 4} L${decoCenter - 4},${decoY} Z`).fill();
  doc.restore();

  doc.moveDown(0.6);

  // Sub-header info (address, phone, GSTIN) — centered
  doc.font('Helvetica').fontSize(9).fillColor('#555555');
  const subParts: string[] = [];
  if (restaurant?.address) subParts.push(restaurant.address);
  if (restaurant?.phone) subParts.push(`Ph: ${restaurant.phone}`);
  if (subParts.length > 0) {
    doc.text(subParts.join('  |  '), startX, doc.y, { align: 'center', width: pageWidth });
  }
  if (gstNumber) {
    doc.text(`GSTIN: ${gstNumber}`, startX, doc.y, { align: 'center', width: pageWidth });
  }

  doc.moveDown(0.8);

  // ── Bill info bar (dark background strip) ──
  const barY = doc.y;
  const barH = 28;
  doc.save();
  doc.rect(startX, barY, pageWidth, barH).fill('#1a1a2e');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  doc.text(`Bill #: ${bill.billNumber || 'N/A'}`, startX + 12, barY + 8, { width: 200 });
  doc.text(tableOrParcel, startX + pageWidth / 2 - 60, barY + 8, { width: 120, align: 'center' });
  doc.text(`Date: ${new Date(bill.createdAt || Date.now()).toLocaleString('en-IN')}`, startX + pageWidth - 212, barY + 8, { width: 200, align: 'right' });
  doc.restore();

  doc.y = barY + barH + 15;

  // ━━━━━━━━━━━━━━━━━━━━  ITEMS TABLE  ━━━━━━━━━━━━━━━━━━━━

  // Column widths
  const colSno = 30;
  const colItem = Math.round((pageWidth - colSno) * 0.46);
  const colQty = Math.round((pageWidth - colSno) * 0.12);
  const colRate = Math.round((pageWidth - colSno) * 0.20);
  const colAmount = pageWidth - colSno - colItem - colQty - colRate;

  // Table header
  const thY = doc.y;
  const thH = 24;
  doc.save();
  doc.rect(startX, thY, pageWidth, thH).fill('#f0f0f5');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e');
  doc.text('#', startX + 6, thY + 7, { width: colSno, align: 'left' });
  doc.text('ITEM', startX + colSno + 4, thY + 7, { width: colItem });
  doc.text('QTY', startX + colSno + colItem, thY + 7, { width: colQty, align: 'center' });
  doc.text('RATE', startX + colSno + colItem + colQty, thY + 7, { width: colRate, align: 'right' });
  doc.text('AMOUNT', startX + colSno + colItem + colQty + colRate, thY + 7, { width: colAmount, align: 'right' });
  doc.restore();

  // Bottom border on header
  doc.lineWidth(1).strokeColor('#1a1a2e')
    .moveTo(startX, thY + thH).lineTo(startX + pageWidth, thY + thH).stroke();

  doc.y = thY + thH + 2;

  // Item rows
  let rowIndex = 0;
  for (const item of combinedItems.values()) {
    const name = item.menuItem?.name || item.name || 'Item';
    const qty = Number(item.quantity || 1);
    const amt = Number(item.subtotal || 0);
    const rate = qty ? (amt / qty) : amt;

    // Paginate if near bottom
    if (doc.y > doc.page.height - doc.page.margins.bottom - 140) {
      doc.addPage();
    }

    const rowY = doc.y;
    const rowH = 22;

    // Alternate row shading
    if (rowIndex % 2 === 0) {
      doc.save();
      doc.rect(startX, rowY, pageWidth, rowH).fill('#fafafa');
      doc.restore();
    }

    doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
    doc.text(String(rowIndex + 1), startX + 6, rowY + 6, { width: colSno, align: 'left' });
    doc.text(name, startX + colSno + 4, rowY + 6, { width: colItem });
    doc.text(String(qty), startX + colSno + colItem, rowY + 6, { width: colQty, align: 'center' });
    doc.text(`Rs ${rate.toFixed(2)}`, startX + colSno + colItem + colQty, rowY + 6, { width: colRate, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9.5)
      .text(`Rs ${amt.toFixed(2)}`, startX + colSno + colItem + colQty + colRate, rowY + 6, { width: colAmount, align: 'right' });

    doc.y = rowY + rowH;
    rowIndex++;
  }

  // Bottom border of items table
  doc.lineWidth(1).strokeColor('#1a1a2e')
    .moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).stroke();

  doc.moveDown(0.8);

  // ━━━━━━━━━━━━━━━━━━━━  TOTALS  ━━━━━━━━━━━━━━━━━━━━

  const labelW = 130;
  const valW = 110;
  const totalsX = startX + pageWidth - labelW - valW - 10;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    const rowY = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#444444');
    doc.text(label, totalsX, rowY, { width: labelW, align: 'right' });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#1a1a2e');
    doc.text(value, totalsX + labelW + 10, rowY, { width: valW, align: 'right' });
    doc.moveDown(0.35);
  };

  drawTotalRow('Subtotal', `Rs ${Number(bill.subtotal || 0).toFixed(2)}`);

  if (hasTax) {
    drawTotalRow(`Tax (${taxPercentage}%)`, `Rs ${Number(bill.taxAmount).toFixed(2)}`);
  }
  if (hasDiscount) {
    const dPct = bill.discountPercentage ? ` (${Number(bill.discountPercentage).toFixed(1)}%)` : '';
    drawTotalRow(`Discount${dPct}`, `- Rs ${Number(bill.discountAmount).toFixed(2)}`);
  }
  if (hasExtra) {
    drawTotalRow('Extra Charges', `Rs ${Number(bill.extraCharges).toFixed(2)}`);
  }

  doc.moveDown(0.3);

  // ── Grand Total box ──
  const gtY = doc.y;
  const gtH = 34;
  const gtX = totalsX - 10;
  const gtW = labelW + valW + 30;
  doc.save();
  doc.roundedRect(gtX, gtY, gtW, gtH, 4).fill('#1a1a2e');
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');
  doc.text('GRAND TOTAL', gtX + 12, gtY + 9, { width: gtW / 2 - 12 });
  doc.text(`Rs ${Number(bill.totalAmount || 0).toFixed(2)}`, gtX + gtW / 2, gtY + 9, { width: gtW / 2 - 12, align: 'right' });
  doc.restore();

  doc.y = gtY + gtH + 20;

  // ━━━━━━━━━━━━━━━━━━━━  FOOTER  ━━━━━━━━━━━━━━━━━━━━

  // Thin separator
  doc.lineWidth(0.5).strokeColor('#dddddd')
    .moveTo(startX + pageWidth * 0.25, doc.y).lineTo(startX + pageWidth * 0.75, doc.y).stroke();
  doc.moveDown(0.7);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e')
    .text('Thank You for Dining with Us!', startX, doc.y, { align: 'center', width: pageWidth });
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8).fillColor('#999999')
    .text('We appreciate your visit. See you again soon!', startX, doc.y, { align: 'center', width: pageWidth });

  if (restaurant?.website || restaurant?.email) {
    doc.moveDown(0.3);
    const contactParts: string[] = [];
    if (restaurant.website) contactParts.push(restaurant.website);
    if (restaurant.email) contactParts.push(restaurant.email);
    doc.font('Helvetica').fontSize(8).fillColor('#999999')
      .text(contactParts.join('  •  '), startX, doc.y, { align: 'center', width: pageWidth });
  }

  // Bottom accent bar
  doc.save();
  doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill('#1a1a2e');
  doc.restore();

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
