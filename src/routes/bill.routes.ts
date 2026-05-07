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
  shareBillLinkSchema,
} from '../validators/bill.validator';

const router = Router();

router.use(requireAuth);

router.get('/', validate(listBillsSchema), billController.getBills);
router.get('/order/:orderId', validate(getBillByOrderSchema), billController.getBillByOrderId);
router.get('/:id', validate(getBillSchema), billController.getBillById);

router.post(
  '/order/:orderId/generate',
  requireRole(['manager', 'super_admin']),
  validate(generateBillSchema),
  billController.generateBill
);

router.post(
  '/:id/payment',
  requireRole(['manager', 'super_admin']),
  validate(recordPaymentSchema),
  billController.recordPayment
);

router.post(
  '/:id/share-link',
  requireRole(['manager', 'super_admin']),
  validate(shareBillLinkSchema),
  billController.createShareLink
);

export default router;
