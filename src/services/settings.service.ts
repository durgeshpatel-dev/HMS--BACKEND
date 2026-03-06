import prisma from '../config/database';
import type {
  UpdateRestaurantInfoInput,
  UpdateRestaurantSettingsInput,
} from '../validators/settings.validator';

class SettingsService {
  async getRestaurantInfo(restaurantId: number) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    return restaurant;
  }

  async updateRestaurantInfo(restaurantId: number, data: UpdateRestaurantInfoInput) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Ensure no other restaurant is using this email.
    if (data.email && data.email !== restaurant.email) {
      const existingRestaurant = await prisma.restaurant.findFirst({
        where: { email: data.email, id: { not: restaurantId } },
      });

      if (existingRestaurant) {
        throw new Error('Email already in use');
      }
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data,
    });

    return updatedRestaurant;
  }

  async updateRestaurantSettings(restaurantId: number, data: UpdateRestaurantSettingsInput) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Merge partial updates into existing JSON settings.
    const updatedSettings = {
      ...(restaurant.settings as Record<string, unknown>),
      ...data,
    };

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        settings: updatedSettings,
      },
    });

    return updatedRestaurant;
  }
}

const settingsService = new SettingsService();
export { settingsService };
