import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import staffController from '../controllers/staff.controller';
import {
  createStaffSchema,
  deleteStaffSchema,
  getStaffSchema,
  updateStaffSchema,
} from '../validators/staff.validator';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['manager', 'super_admin']));

router.get('/staff', validate(getStaffSchema), staffController.getAllStaff);
router.post('/staff', validate(createStaffSchema), staffController.createStaff);
router.put('/staff/:id', validate(updateStaffSchema), staffController.updateStaff);
router.delete('/staff/:id', validate(deleteStaffSchema), staffController.deleteStaff);

export default router;
