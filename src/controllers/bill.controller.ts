import { Request, Response } from 'express';
import { billService } from '../services/bill.service';
import { sendError, sendSuccess } from '../utils/response.util';
import type { GenerateBillInput, RecordPaymentInput } from '../validators/bill.validator';

const parseId = (value: string | string[]) => parseInt(String(value), 10);

class BillController {
  async getBills(req: Request, res: Response) {
    try {
      const user = req.user!;
      const paymentStatus = req.query.paymentStatus as string | undefined;
      const bills = await billService.getBills(user.restaurantId, paymentStatus);
      return sendSuccess(res, bills, 'Bills retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getBillById(req: Request, res: Response) {
    try {
      const user = req.user!;
      const id = parseId(req.params.id);
      const bill = await billService.getBillById(id, user.restaurantId);
      return sendSuccess(res, bill, 'Bill retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes('not found') ? 404 : 500);
    }
  }

  async getBillByOrderId(req: Request, res: Response) {
    try {
      const user = req.user!;
      const orderId = parseId(req.params.orderId);
      const bill = await billService.getBillByOrderId(orderId, user.restaurantId);
      return sendSuccess(res, bill, 'Bill retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes('not found') ? 404 : 500);
    }
  }

  async generateBill(req: Request, res: Response) {
    try {
      const user = req.user!;
      const orderId = parseId(req.params.orderId);
      const payload: GenerateBillInput = req.body;
      const bill = await billService.generateBill(orderId, user.restaurantId, payload);
      return sendSuccess(res, bill, 'Bill generated successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async recordPayment(req: Request, res: Response) {
    try {
      const user = req.user!;
      const billId = parseId(req.params.id);
      const payload: RecordPaymentInput = req.body;
      const result = await billService.recordPayment(billId, user.restaurantId, payload);
      return sendSuccess(res, result, 'Payment recorded successfully');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new BillController();
