import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess, sendError } from '../utils/response.util';

export class AnalyticsController {
  async getSalesAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { startDate, endDate, groupBy } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const group = (groupBy as 'day' | 'week' | 'month') || 'day';

      const data = await analyticsService.getSalesAnalytics(user.restaurantId, start, end, group);

      return sendSuccess(res, data, 'Sales analytics retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getTopItems(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { limit, startDate, endDate } = req.query;

      const l = limit ? parseInt(limit as string) : 10;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const data = await analyticsService.getTopItems(user.restaurantId, l, start, end);

      return sendSuccess(res, data, 'Top items retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getOrderSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const data = await analyticsService.getOrderSummary(user.restaurantId, start, end);

      return sendSuccess(res, data, 'Order summary retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getPaymentMethodBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const data = await analyticsService.getPaymentMethodBreakdown(user.restaurantId, start, end);

      return sendSuccess(res, data, 'Payment method breakdown retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getWaiterPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { limit, startDate, endDate } = req.query;

      const l = limit ? parseInt(limit as string) : 10;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const data = await analyticsService.getWaiterPerformance(user.restaurantId, start, end, l);

      return sendSuccess(res, data, 'Waiter performance retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }
}

export default new AnalyticsController();
