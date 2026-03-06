import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../utils/response.util';
import { staffService } from '../services/staff.service';
import type { CreateStaffInput, UpdateStaffInput } from '../validators/staff.validator';

class StaffController {
  async getAllStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const role = req.query.role as string | undefined;
      const data = await staffService.getAllStaff(user.restaurantId, role);
      return sendSuccess(res, data, 'Staff retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const payload: CreateStaffInput = req.body;
      const data = await staffService.createStaff(user.restaurantId, payload);
      return sendSuccess(res, data, 'Staff created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(String(req.params.id), 10);
      const payload: UpdateStaffInput = req.body;
      const data = await staffService.updateStaff(id, user.restaurantId, payload);
      return sendSuccess(res, data, 'Staff updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Staff not found' ? 404 : 400);
    }
  }

  async deleteStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(String(req.params.id), 10);
      const data = await staffService.deleteStaff(id, user.restaurantId);
      return sendSuccess(res, data, data.message);
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Staff not found' ? 404 : 400);
    }
  }
}

export default new StaffController();
