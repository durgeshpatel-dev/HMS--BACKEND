import { Router } from 'express';
import orderController from '../controllers/order.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  addOrderItemsSchema,
  updateOrderItemSchema,
} from '../validators/order.validator';

const router = Router();

// All order routes require authentication
router.use(requireAuth);

router.get('/', orderController.getAllOrders);
router.get('/kitchen', orderController.getKitchenOrders);
router.get('/my-orders', orderController.getOrdersByWaiter);
router.get('/:id', orderController.getOrderById);

router.post(
  '/',
  requireRole(['waiter']),
  validate(createOrderSchema),
  orderController.createOrder
);

router.put(
  '/:id',
  validate(updateOrderSchema),
  orderController.updateOrder
);

router.post(
  '/:id/items',
  requireRole(['waiter']),
  validate(addOrderItemsSchema),
  orderController.addOrderItems
);

router.put(
  '/:orderId/items/:itemId',
  validate(updateOrderItemSchema),
  orderController.updateOrderItem
);

router.delete(
  '/:orderId/items/:itemId',
  requireRole(['waiter', 'manager']),
  orderController.deleteOrderItem
);

router.post(
  '/:id/cancel',
  requireRole(['waiter', 'manager']),
  orderController.cancelOrder
);

export default router;
