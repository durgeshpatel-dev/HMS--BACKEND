import { Request, Response } from 'express';
import { superAdminService } from '../services/superadmin.service';
import { sendSuccess, sendError, sendPaginatedSuccess } from '../utils/response.util';

/** Safely extract a single string from an Express query value. */
const qs = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

class SuperAdminController {
  // ─── Auth ────────────────────────────────────────────────────────────

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return sendError(res, 'Email and password are required', 400);
      }
      const result = await superAdminService.login(email, password);
      return sendSuccess(res, result, 'Login successful');
    } catch (error: any) {
      return sendError(res, error.message || 'Login failed', 401);
    }
  }

  // ─── Platform Stats ──────────────────────────────────────────────────

  async getPlatformStats(req: Request, res: Response) {
    try {
      const stats = await superAdminService.getPlatformStats();
      const systemSettings = require('../services/settings.service').settingsService.getSystemSettings();
      return sendSuccess(res, { ...stats, systemSettings });
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch platform stats');
    }
  }

  async updateSystemSettings(req: Request, res: Response) {
    try {
      const updated = require('../services/settings.service').settingsService.updateSystemSettings(req.body);
      return sendSuccess(res, updated, 'System settings updated');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update system settings');
    }
  }

  // ─── Pending Approvals ───────────────────────────────────────────────

  async getPendingApprovals(req: Request, res: Response) {
    try {
      const approvals = await superAdminService.getPendingApprovals();
      return sendSuccess(res, approvals);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch pending approvals');
    }
  }

  // ─── Restaurant Management ───────────────────────────────────────────

  async getAllRestaurants(req: Request, res: Response) {
    try {
      const restaurants = await superAdminService.getAllRestaurants(
        qs(req.query.search),
        qs(req.query.status),
      );
      return sendSuccess(res, restaurants);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch restaurants');
    }
  }

  async getRestaurantById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid restaurant ID', 400);
      const restaurant = await superAdminService.getRestaurantById(id);
      return sendSuccess(res, restaurant);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch restaurant', 404);
    }
  }

  async updateRestaurant(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid restaurant ID', 400);
      const restaurant = await superAdminService.updateRestaurant(id, req.body);
      return sendSuccess(res, restaurant, 'Restaurant updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update restaurant', 400);
    }
  }

  async updateRestaurantSettings(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid restaurant ID', 400);
      const restaurant = await superAdminService.updateRestaurantSettings(id, req.body);
      return sendSuccess(res, restaurant, 'Restaurant settings updated');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update settings', 400);
    }
  }

  async pauseRestaurant(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid restaurant ID', 400);
      const restaurant = await superAdminService.pauseRestaurant(id);
      return sendSuccess(res, restaurant, 'Restaurant paused successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to pause restaurant', 400);
    }
  }

  async unpauseRestaurant(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid restaurant ID', 400);
      const restaurant = await superAdminService.unpauseRestaurant(id);
      return sendSuccess(res, restaurant, 'Restaurant unpaused successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to unpause restaurant', 400);
    }
  }

  async deleteRestaurant(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid restaurant ID', 400);
      const result = await superAdminService.deleteRestaurant(id);
      return sendSuccess(res, result, 'Restaurant deleted permanently');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete restaurant', 400);
    }
  }

  // ─── User/Manager Management ─────────────────────────────────────────

  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await superAdminService.getAllUsers(
        qs(req.query.status),
        qs(req.query.search),
      );
      return sendSuccess(res, users);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch users');
    }
  }

  async approveUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);
      const user = await superAdminService.approveUser(id);
      return sendSuccess(res, user, 'User approved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to approve user', 400);
    }
  }

  async rejectUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);
      const user = await superAdminService.rejectUser(id);
      return sendSuccess(res, user, 'User rejected');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to reject user', 400);
    }
  }

  async suspendUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);
      const user = await superAdminService.suspendUser(id);
      return sendSuccess(res, user, 'User suspended');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to suspend user', 400);
    }
  }

  async unsuspendUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);
      const user = await superAdminService.unsuspendUser(id);
      return sendSuccess(res, user, 'User unsuspended');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to unsuspend user', 400);
    }
  }

  async resetUserPassword(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return sendError(res, 'Password must be at least 6 characters', 400);
      }
      const result = await superAdminService.resetUserPassword(id, newPassword);
      return sendSuccess(res, result, 'Password reset successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to reset password', 400);
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid user ID', 400);
      const result = await superAdminService.deleteUser(id);
      return sendSuccess(res, result, 'User deleted');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete user', 400);
    }
  }

  // ─── Staff Management ────────────────────────────────────────────────

  async getAllStaff(req: Request, res: Response) {
    try {
      const rid = qs(req.query.restaurantId);
      const staff = await superAdminService.getAllStaff(
        rid ? parseInt(rid) : undefined,
        qs(req.query.role),
      );
      return sendSuccess(res, staff);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch staff');
    }
  }

  async resetStaffPin(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid staff ID', 400);
      const { newPin } = req.body;
      if (!newPin || newPin.length < 4) {
        return sendError(res, 'PIN must be at least 4 digits', 400);
      }
      const result = await superAdminService.resetStaffPin(id, newPin);
      return sendSuccess(res, result, 'PIN reset successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to reset PIN', 400);
    }
  }

  async toggleStaffActive(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid staff ID', 400);
      const staff = await superAdminService.toggleStaffActive(id);
      return sendSuccess(res, staff, `Staff ${staff.isActive ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to toggle staff status', 400);
    }
  }

  // ─── Orders ──────────────────────────────────────────────────────────

  async getAllOrders(req: Request, res: Response) {
    try {
      const rid = qs(req.query.restaurantId);
      const sd = qs(req.query.startDate);
      const ed = qs(req.query.endDate);
      const pg = qs(req.query.page);
      const lm = qs(req.query.limit);
      const result = await superAdminService.getAllOrders({
        restaurantId: rid ? parseInt(rid) : undefined,
        status: qs(req.query.status),
        startDate: sd ? new Date(sd) : undefined,
        endDate: ed ? new Date(ed) : undefined,
        page: pg ? parseInt(pg) : 1,
        limit: lm ? parseInt(lm) : 50,
      });
      return sendPaginatedSuccess(
        res, result.data, result.total, result.page, result.limit,
      );
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch orders');
    }
  }

  async forceUpdateOrderStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return sendError(res, 'Invalid order ID', 400);
      const { status } = req.body;
      if (!status) return sendError(res, 'Status is required', 400);
      const order = await superAdminService.forceUpdateOrderStatus(id, status);
      return sendSuccess(res, order, `Order status updated to ${status}`);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update order', 400);
    }
  }

  // ─── Bills & Payments ────────────────────────────────────────────────

  async getAllBills(req: Request, res: Response) {
    try {
      const rid = qs(req.query.restaurantId);
      const pg = qs(req.query.page);
      const lm = qs(req.query.limit);
      const result = await superAdminService.getAllBills({
        restaurantId: rid ? parseInt(rid) : undefined,
        paymentStatus: qs(req.query.paymentStatus),
        page: pg ? parseInt(pg) : 1,
        limit: lm ? parseInt(lm) : 50,
      });
      return sendPaginatedSuccess(
        res, result.data, result.total, result.page, result.limit,
      );
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch bills');
    }
  }

  async getAllPayments(req: Request, res: Response) {
    try {
      const rid = qs(req.query.restaurantId);
      const pg = qs(req.query.page);
      const lm = qs(req.query.limit);
      const result = await superAdminService.getAllPayments({
        restaurantId: rid ? parseInt(rid) : undefined,
        page: pg ? parseInt(pg) : 1,
        limit: lm ? parseInt(lm) : 50,
      });
      return sendPaginatedSuccess(
        res, result.data, result.total, result.page, result.limit,
      );
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch payments');
    }
  }

  // ─── Analytics ───────────────────────────────────────────────────────

  async getPlatformAnalytics(req: Request, res: Response) {
    try {
      const analytics = await superAdminService.getPlatformAnalytics();
      return sendSuccess(res, analytics);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch analytics');
    }
  }
}

const superAdminController = new SuperAdminController();
export default superAdminController;
