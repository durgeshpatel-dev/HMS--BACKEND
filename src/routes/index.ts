import { Router } from 'express';
import authRoutes from './auth.routes';
import menuRoutes from './menu.routes';
import tableRoutes from './table.routes';
import orderRoutes from './order.routes';
import managerRoutes from './manager.routes';
import billRoutes from './bill.routes';

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
router.use('/bills', billRoutes);

export default router;
