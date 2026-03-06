import { Request, Response, NextFunction } from 'express';
import { settingsService } from "../services/settings.service";
import { sendSuccess, sendError } from '../utils/response.util';

export class SettingsController {
  async getRestaurantSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const settings = await settingsService.getRestaurantInfo(user.restaurantId);
      return sendSuccess(res, settings, 'Restaurant settings retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Restaurant not found' ? 404 : 500);
    }
  }

  async updateRestaurantInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await settingsService.updateRestaurantInfo(user.restaurantId, req.body);
      return sendSuccess(res, data, 'Restaurant info updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Restaurant not found' ? 404 : 400);
    }
  }

  async updateRestaurantSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const settings = await settingsService.updateRestaurantSettings(user.restaurantId, req.body);
      return sendSuccess(res, settings, 'Restaurant settings updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Restaurant not found' ? 404 : 400);
    }
  }
}

export default new SettingsController();
