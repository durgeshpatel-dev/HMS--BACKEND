import { Router } from 'express';
import menuController from '../controllers/menu.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from '../validators/menu.validator';

const router = Router();

// All menu routes require authentication
router.use(requireAuth);

// ========== Category Routes ==========
router.get('/categories', menuController.getAllCategories);
router.get('/categories/:id', menuController.getCategoryById);
router.post(
  '/categories',
  requireRole(['manager']),
  validate(createCategorySchema),
  menuController.createCategory
);
router.put(
  '/categories/:id',
  requireRole(['manager']),
  validate(updateCategorySchema),
  menuController.updateCategory
);
router.delete(
  '/categories/:id',
  requireRole(['manager']),
  menuController.deleteCategory
);

// ========== Menu Item Routes ==========
router.get('/items', menuController.getAllMenuItems);
router.get('/items/:id', menuController.getMenuItemById);
router.post(
  '/items',
  requireRole(['manager']),
  validate(createMenuItemSchema),
  menuController.createMenuItem
);
router.put(
  '/items/:id',
  requireRole(['manager']),
  validate(updateMenuItemSchema),
  menuController.updateMenuItem
);
router.delete(
  '/items/:id',
  requireRole(['manager']),
  menuController.deleteMenuItem
);
router.patch(
  '/items/:id/toggle-availability',
  requireRole(['manager']),
  menuController.toggleMenuItemAvailability
);

export default router;
