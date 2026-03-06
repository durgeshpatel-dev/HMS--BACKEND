import { Request, Response, NextFunction } from 'express';
import { menuService } from "../services/menu.service";
import { sendSuccess, sendError } from '../utils/response.util';

export class MenuController {
  async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const categories = await menuService.getAllCategories(user.restaurantId);
      return sendSuccess(res, categories, 'Categories retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const category = await menuService.getCategoryById(id, user.restaurantId);
      return sendSuccess(res, category, 'Category retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Category not found' ? 404 : 500);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const category = await menuService.createCategory(req.body, user.restaurantId);
      return sendSuccess(res, category, 'Category created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const category = await menuService.updateCategory(id, req.body, user.restaurantId);
      return sendSuccess(res, category, 'Category updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Category not found' ? 404 : 400);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      await menuService.deleteCategory(id, user.restaurantId);
      return sendSuccess(res, null, 'Category deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Category not found' ? 404 : 400);
    }
  }

  async getAllMenuItems(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const menuItems = await menuService.getAllMenuItems(user.restaurantId, categoryId);
      return sendSuccess(res, menuItems, 'Menu items retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  async getMenuItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const menuItem = await menuService.getMenuItemById(id, user.restaurantId);
      return sendSuccess(res, menuItem, 'Menu item retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Menu item not found' ? 404 : 500);
    }
  }

  async createMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const menuItem = await menuService.createMenuItem(req.body, user.restaurantId);
      return sendSuccess(res, menuItem, 'Menu item created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const menuItem = await menuService.updateMenuItem(id, req.body, user.restaurantId);
      return sendSuccess(res, menuItem, 'Menu item updated successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Menu item not found' ? 404 : 400);
    }
  }

  async deleteMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      await menuService.deleteMenuItem(id, user.restaurantId);
      return sendSuccess(res, null, 'Menu item deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Menu item not found' ? 404 : 400);
    }
  }

  async toggleMenuItemAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id as string);
      const menuItem = await menuService.toggleMenuItemAvailability(id, user.restaurantId);
      return sendSuccess(res, menuItem, 'Menu item availability toggled successfully');
    } catch (error: any) {
      return sendError(res, error.message, error.message === 'Menu item not found' ? 404 : 500);
    }
  }
}

export default new MenuController();
