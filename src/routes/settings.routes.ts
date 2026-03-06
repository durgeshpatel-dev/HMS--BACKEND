import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import settingsController from '../controllers/settings.controller';
import {
  updateRestaurantInfoSchema,
  updateRestaurantSettingsSchema,
} from '../validators/settings.validator';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['manager', 'super_admin']));

router.get('/', settingsController.getRestaurantSettings);
router.put('/info', validate(updateRestaurantInfoSchema), settingsController.updateRestaurantInfo);
router.put('/', validate(updateRestaurantSettingsSchema), settingsController.updateRestaurantSettings);

export default router;
