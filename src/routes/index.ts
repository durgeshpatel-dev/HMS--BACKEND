import { Router } from 'express';
import authRoutes from './auth.routes';
import menuRoutes from './menu.routes';
import tableRoutes from './table.routes';
import orderRoutes from './order.routes';
import managerRoutes from './manager.routes';
import billRoutes from './bill.routes';
import billController from '../controllers/bill.controller';
import settingsRoutes from './settings.routes';
import uploadRoutes from './upload.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

// Health check for API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/tables', tableRoutes);
router.use('/orders', orderRoutes);
router.use('/manager', managerRoutes);
// Public bill download link (token protected)
router.get('/bills/:id/download', billController.downloadBillPdf);
router.use('/bills', billRoutes);
router.use('/settings', settingsRoutes);
router.use('/upload', uploadRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
