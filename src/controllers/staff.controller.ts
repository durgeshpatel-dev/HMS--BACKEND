import { Request, Response, NextFunction } from 'express';
import { sendError, sendSuccess } from '../utils/response.util';
import { staffService } from '../services/staff.service';
import type { CreateStaffInput, UpdateStaffInput, ForgotStaffPinInput, ResetStaffPinInput } from '../validators/staff.validator';

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

  async forgotPin(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(String(req.params.id), 10);
      const payload: ForgotStaffPinInput = req.body;
      const data = await staffService.forgotPin(id, user.restaurantId, payload);
      return sendSuccess(res, data, 'Staff PIN reset successfully via OTP');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Staff not found' ? 404 : 400);
    }
  }

  async resetPin(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const payload: ResetStaffPinInput = req.body;
      
      // If accessed via /staff/me/reset-pin, id is user.userId
      // If accessed via /manager/staff/:id/reset-pin, id is req.params.id
      const id = req.params.id ? parseInt(String(req.params.id), 10) : user.userId;

      const data = await staffService.resetPin(id, user.restaurantId, payload);
      return sendSuccess(res, data, 'Staff PIN changed successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Staff not found' ? 404 : 400);
    }
  }
}

export default new StaffController();
