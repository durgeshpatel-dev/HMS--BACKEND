import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import analyticsController from '../controllers/analytics.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['manager', 'super_admin']));

router.get('/sales', analyticsController.getSalesAnalytics);
router.get('/top-items', analyticsController.getTopItems);
router.get('/order-summary', analyticsController.getOrderSummary);
router.get('/payment-breakdown', analyticsController.getPaymentMethodBreakdown);
router.get('/waiter-performance', analyticsController.getWaiterPerformance);

export default router;
