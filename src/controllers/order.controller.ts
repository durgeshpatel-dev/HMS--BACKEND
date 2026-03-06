import { Request, Response, NextFunction } from 'express';
import { orderService } from "../services/order.service";
import { sendSuccess, sendError } from '../utils/response.util';

export class OrderController {
  async getAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orders = await orderService.getAllOrders(user.restaurantId);
      return sendSuccess(res, orders, 'Orders retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const order = await orderService.getOrderById(id, user.restaurantId);
      return sendSuccess(res, order, 'Order retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 500);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      
      // Only waiters can create orders
      if (user.role !== 'waiter') {
        return sendError(res, 'Only waiters can create orders', 403);
      }

      const order = await orderService.createOrder(req.body, user.restaurantId, user.id);
      return sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const order = await orderService.updateOrder(id, req.body, user.restaurantId);
      return sendSuccess(res, order, 'Order updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 400);
    }
  }

  async addOrderItems(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const order = await orderService.addOrderItems(id, req.body, user.restaurantId);
      return sendSuccess(res, order, 'Items added to order successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 400);
    }
  }

  async updateOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orderId = parseInt(req.params.orderId as string);
      const itemId = parseInt(req.params.itemId as string);
      const order = await orderService.updateOrderItem(orderId, itemId, req.body, user.restaurantId);
      return sendSuccess(res, order, 'Order item updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes('not found') ? 404 : 400);
    }
  }

  async deleteOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orderId = parseInt(req.params.orderId as string);
      const itemId = parseInt(req.params.itemId as string);
      const order = await orderService.deleteOrderItem(orderId, itemId, user.restaurantId);
      return sendSuccess(res, order, 'Order item deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes('not found') ? 404 : 400);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const order = await orderService.cancelOrder(id, user.restaurantId);
      return sendSuccess(res, order, 'Order cancelled successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 400);
    }
  }

  async getOrdersByWaiter(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      
      // Only waiters can access this endpoint
      if (user.role !== 'waiter') {
        return sendError(res, 'Only waiters can access their orders', 403);
      }

      const orders = await orderService.getOrdersByWaiter(user.id, user.restaurantId);
      return sendSuccess(res, orders, 'Waiter orders retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  async getKitchenOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orders = await orderService.getKitchenOrders(user.restaurantId);
      return sendSuccess(res, orders, 'Kitchen orders retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }
}

export default new OrderController();
