import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/superadmin.middleware';
import superAdminController from '../controllers/superadmin.controller';

const router = Router();

// ─── Public (no auth) ──────────────────────────────────────────────────
router.post('/login', superAdminController.login);

// ─── All routes below require super admin auth ─────────────────────────
router.use(requireSuperAdmin);

// Platform overview
router.get('/stats', superAdminController.getPlatformStats);
router.get('/pending-approvals', superAdminController.getPendingApprovals);
router.get('/analytics', superAdminController.getPlatformAnalytics);
router.put('/system-settings', superAdminController.updateSystemSettings);

// Restaurant management
router.get('/restaurants', superAdminController.getAllRestaurants);
router.get('/restaurants/:id', superAdminController.getRestaurantById);
router.put('/restaurants/:id', superAdminController.updateRestaurant);
router.put('/restaurants/:id/settings', superAdminController.updateRestaurantSettings);
router.post('/restaurants/:id/pause', superAdminController.pauseRestaurant);
router.post('/restaurants/:id/unpause', superAdminController.unpauseRestaurant);
router.delete('/restaurants/:id', superAdminController.deleteRestaurant);

// User/Manager management
router.get('/users', superAdminController.getAllUsers);
router.post('/users/:id/approve', superAdminController.approveUser);
router.post('/users/:id/reject', superAdminController.rejectUser);
router.post('/users/:id/suspend', superAdminController.suspendUser);
router.post('/users/:id/unsuspend', superAdminController.unsuspendUser);
router.post('/users/:id/reset-password', superAdminController.resetUserPassword);
router.delete('/users/:id', superAdminController.deleteUser);

// Staff management
router.get('/staff', superAdminController.getAllStaff);
router.post('/staff/:id/reset-pin', superAdminController.resetStaffPin);
router.post('/staff/:id/toggle-active', superAdminController.toggleStaffActive);
router.delete('/staff/:id', superAdminController.deleteStaff);

// Orders
router.get('/orders', superAdminController.getAllOrders);
router.post('/orders/:id/force-status', superAdminController.forceUpdateOrderStatus);

// Bills & Payments
router.get('/bills', superAdminController.getAllBills);
router.get('/payments', superAdminController.getAllPayments);

export default router;
