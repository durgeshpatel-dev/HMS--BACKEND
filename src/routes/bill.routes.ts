import { Router } from 'express';
import billController from '../controllers/bill.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  generateBillSchema,
  getBillByOrderSchema,
  getBillSchema,
  listBillsSchema,
  recordPaymentSchema,
} from '../validators/bill.validator';

const router = Router();

router.use(requireAuth);

router.get('/', validate(listBillsSchema), billController.getBills);
router.get('/order/:orderId', validate(getBillByOrderSchema), billController.getBillByOrderId);
router.get('/:id', validate(getBillSchema), billController.getBillById);

router.post(
  '/order/:orderId/generate',
  requireRole(['manager', 'waiter', 'cashier']),
  validate(generateBillSchema),
  billController.generateBill
);

router.post(
  '/:id/payment',
  requireRole(['manager', 'waiter', 'cashier']),
  validate(recordPaymentSchema),
  billController.recordPayment
);

export default router;
