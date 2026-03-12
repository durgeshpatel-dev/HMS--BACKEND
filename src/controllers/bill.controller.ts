import { Request, Response } from 'express';
import { billService } from '../services/bill.service';
import { sendError, sendSuccess, sendPaginatedSuccess } from '../utils/response.util';
import { emitBillUpdate, emitOrderUpdate, emitTableStatusUpdate } from '../config/socket';
import { parseId, parsePagination } from '../utils/shared.util';
import { getErrorStatusCode } from '../utils/errors.util';
import type { GenerateBillInput, RecordPaymentInput } from '../validators/bill.validator';

class BillController {
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
}

export default new BillController();
