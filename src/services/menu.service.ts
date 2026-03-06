import prisma from '../config/database';
import type { CreateCategoryInput, UpdateCategoryInput, CreateMenuItemInput, UpdateMenuItemInput } from '../validators/menu.validator';

class MenuService {
  // ========== Category Methods ==========
  
  async getAllCategories(restaurantId: number) {
    return await prisma.category.findMany({
      where: { restaurantId },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getCategoryById(id: number, restaurantId: number) {
    const category = await prisma.category.findFirst({
      where: { id, restaurantId },
      include: {
        menuItems: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  async createCategory(data: CreateCategoryInput, restaurantId: number) {
    return await prisma.category.create({
      data: {
        ...data,
        restaurantId,
      },
    });
  }

  async updateCategory(id: number, data: UpdateCategoryInput, restaurantId: number) {
    const category = await prisma.category.findFirst({
      where: { id, restaurantId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return await prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: number, restaurantId: number) {
    const category = await prisma.category.findFirst({
      where: { id, restaurantId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has menu items
    const menuItemsCount = await prisma.menuItem.count({
      where: { categoryId: id },
    });

    if (menuItemsCount > 0) {
      throw new Error('Cannot delete category with existing menu items');
    }

    await prisma.category.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }

  // ========== Menu Item Methods ==========

  async getAllMenuItems(restaurantId: number, categoryId?: number) {
    const where: any = { 
      restaurantId 
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    return await prisma.menuItem.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getMenuItemById(id: number, restaurantId: number) {
    const menuItem = await prisma.menuItem.findFirst({
      where: { 
        id,
        restaurantId,
      },
      include: {
        category: true,
      },
    });

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    return menuItem;
  }

  async createMenuItem(data: CreateMenuItemInput, restaurantId: number) {
    // Verify category belongs to restaurant
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: data.categoryId,
          restaurantId,
        },
      });

      if (!category) {
        throw new Error('Category not found or does not belong to this restaurant');
      }
    }

    return await prisma.menuItem.create({
      data: {
        ...data,
        restaurantId,
      },
      include: {
        category: true,
      },
    });
  }

  async updateMenuItem(id: number, data: UpdateMenuItemInput, restaurantId: number) {
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // If updating categoryId, verify it belongs to restaurant
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: data.categoryId,
          restaurantId,
        },
      });

      if (!category) {
        throw new Error('Category not found or does not belong to this restaurant');
      }
    }

    return await prisma.menuItem.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async deleteMenuItem(id: number, restaurantId: number) {
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    await prisma.menuItem.delete({
      where: { id },
    });

    return { message: 'Menu item deleted successfully' };
  }

  async toggleMenuItemAvailability(id: number, restaurantId: number) {
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    return await prisma.menuItem.update({
      where: { id },
      data: {
        isAvailable: !menuItem.isAvailable,
      },
    });
  }
}

const menuService = new MenuService();
export { menuService };
