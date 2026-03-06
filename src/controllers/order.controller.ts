import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { sendSuccess, sendError } from '../utils/response.util';
import type { CreateOrderInput, UpdateOrderInput, AddOrderItemsInput, UpdateOrderItemInput } from '../validators/order.validator';

const parseId = (value: string | string[]) => parseInt(String(value), 10);

export class OrderController {
  async getAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orders = await orderService.getAllOrders(user.restaurantId);
      return sendSuccess(res, orders, 'Orders retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseId(req.params.id);
      const order = await orderService.getOrderById(id, user.restaurantId);
      return sendSuccess(res, order, 'Order retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 500);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const waiterId = user.userType === 'staff' ? user.userId : undefined;

      const data: CreateOrderInput = req.body;
      const order = await orderService.createOrder(data, user.restaurantId, waiterId);
      return sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseId(req.params.id);
      const data: UpdateOrderInput = req.body;
      const order = await orderService.updateOrder(id, data, user.restaurantId);
      return sendSuccess(res, order, 'Order updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 400);
    }
  }

  async addOrderItems(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseId(req.params.id);
      const data: AddOrderItemsInput = req.body;
      const order = await orderService.addOrderItems(id, data, user.restaurantId);
      return sendSuccess(res, order, 'Items added to order successfully');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orderId = parseId(req.params.orderId);
      const itemId = parseId(req.params.itemId);
      const data: UpdateOrderItemInput = req.body;
      const order = await orderService.updateOrderItem(orderId, itemId, data, user.restaurantId);
      return sendSuccess(res, order, 'Order item updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orderId = parseId(req.params.orderId);
      const itemId = parseId(req.params.itemId);
      const order = await orderService.deleteOrderItem(orderId, itemId, user.restaurantId);
      return sendSuccess(res, order, 'Order item deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseId(req.params.id);
      const order = await orderService.cancelOrder(id, user.restaurantId);
      return sendSuccess(res, order, 'Order cancelled successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Order not found' ? 404 : 400);
    }
  }

  async getOrdersByWaiter(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orders = await orderService.getOrdersByWaiter(user.userId, user.restaurantId);
      return sendSuccess(res, orders, 'Orders retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getKitchenOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orders = await orderService.getKitchenOrders(user.restaurantId);
      return sendSuccess(res, orders, 'Kitchen orders retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }
}

export default new OrderController();
