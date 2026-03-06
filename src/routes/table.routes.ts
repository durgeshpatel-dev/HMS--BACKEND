import { Router } from 'express';
import tableController from '../controllers/table.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createTableSchema,
  updateTableSchema,
  updateTableStatusSchema,
} from '../validators/table.validator';

const router = Router();

// All table routes require authentication
router.use(requireAuth);

router.get('/', tableController.getAllTables);
router.get('/available', tableController.getAvailableTables);
router.get('/stats', tableController.getTableStats);
router.get('/:id', tableController.getTableById);

router.post(
  '/',
  requireRole(['manager']),
  validate(createTableSchema),
  tableController.createTable
);

router.put(
  '/:id',
  requireRole(['manager']),
  validate(updateTableSchema),
  tableController.updateTable
);

router.patch(
  '/:id/status',
  validate(updateTableStatusSchema),
  tableController.updateTableStatus
);

router.delete(
  '/:id',
  requireRole(['manager']),
  tableController.deleteTable
);

export default router;
