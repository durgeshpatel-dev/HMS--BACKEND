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

function buildBillViewerHtml(restName: string, billNumber: string, fileName: string, pdfUrl: string): string {
  // Escape strings for safe HTML embedding
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>Bill ${esc(billNumber)} | ${esc(restName)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#333;min-height:100vh;display:flex;flex-direction:column}
    .header{background:#1a1a2e;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .header h1{font-size:16px;font-weight:600;letter-spacing:0.5px}
    .header .bill-num{font-size:12px;opacity:0.8;margin-top:2px}
    .dl-btn{background:#fff;color:#1a1a2e;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.2s;text-decoration:none}
    .dl-btn:hover{background:#e8e8ff;transform:translateY(-1px)}
    .dl-btn:active{transform:translateY(0)}
    .dl-btn svg{width:18px;height:18px}
    .viewer{flex:1;display:flex;flex-direction:column;padding:0;min-height:0}
    .viewer embed,.viewer iframe,.viewer object{width:100%;flex:1;border:none;min-height:75vh}
    .fallback{padding:40px 20px;text-align:center;display:none}
    .fallback p{margin-bottom:16px;color:#666;font-size:15px}
    .fallback .dl-btn{display:inline-flex;margin:0 auto}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.4s;z-index:100;pointer-events:none;display:flex;align-items:center;gap:8px}
    .toast.show{opacity:1}
    .toast svg{width:18px;height:18px;flex-shrink:0}
    @media(max-width:480px){
      .header{padding:12px 16px}
      .header h1{font-size:14px}
      .dl-btn{padding:8px 14px;font-size:13px}
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${esc(restName)}</h1>
      <div class="bill-num">Bill #${esc(billNumber)}</div>
    </div>
    <a id="manualDl" class="dl-btn" href="${esc(pdfUrl)}" download="${esc(fileName)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download
    </a>
  </div>

  <div class="viewer" id="viewer">
    <object data="${esc(pdfUrl)}" type="application/pdf" id="pdfObject">
      <iframe src="${esc(pdfUrl)}" id="pdfIframe"></iframe>
    </object>
  </div>

  <div class="fallback" id="fallback">
    <p>Could not preview the bill. Tap below to download.</p>
    <a class="dl-btn" href="${esc(pdfUrl)}" download="${esc(fileName)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download Bill PDF
    </a>
  </div>

  <div class="toast" id="toast">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span id="toastMsg">Bill saved!</span>
  </div>

  <script>
    (function(){
      var pdfUrl = "${pdfUrl.replace(/"/g, '\\"')}";
      var fileName = "${fileName.replace(/"/g, '\\"')}";

      function showToast(msg) {
        var t = document.getElementById('toast');
        document.getElementById('toastMsg').textContent = msg;
        t.classList.add('show');
        setTimeout(function(){ t.classList.remove('show'); }, 3000);
      }

      function triggerDownload() {
        fetch(pdfUrl)
          .then(function(r) {
            if (!r.ok) throw new Error('fetch failed');
            return r.blob();
          })
          .then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function() {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 200);
            showToast('Bill saved to your device!');
          })
          .catch(function() {
            // Fallback: direct link click
            var a = document.getElementById('manualDl');
            if (a) a.click();
          });
      }

      // Auto-download after short delay (gives browser time to render the PDF)
      setTimeout(triggerDownload, 1200);

      // Also attach download to the manual button using blob method
      document.getElementById('manualDl').addEventListener('click', function(e) {
        e.preventDefault();
        triggerDownload();
      });
    })();
  </script>
</body>
</html>`;
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
        select: { name: true, phone: true, address: true, settings: true, email: true },
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

      // If raw=1, serve the actual PDF binary (used by the viewer page)
      if (req.query.raw === '1') {
        return buildBillPdf(res, bill, restaurant, orders);
      }

      // Default: serve an HTML viewer that shows the PDF AND auto-downloads it
      const restName = restaurant?.name || 'Restaurant';
      const billNumber = bill.billNumber || String(bill.id);
      const fileName = `bill-${billNumber}.pdf`;
      const baseUrl = getBaseUrl(req);
      const pdfUrl = `${baseUrl}/api/v1/bills/${billId}/download?token=${encodeURIComponent(token)}&raw=1`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(buildBillViewerHtml(restName, billNumber, fileName, pdfUrl));
    } catch (error: any) {
      return sendError(res, error.message, getErrorStatusCode(error, 500));
    }
  }
}

export default new BillController();
