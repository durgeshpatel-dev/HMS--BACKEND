import { z } from 'zod';

// Category validators
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters'),
    description: z.string().optional(),
    displayOrder: z.number().int().min(0).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid category ID'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

// Menu Item validators
export const createMenuItemSchema = z.object({
  body: z.object({
    categoryId: z.number().int().positive('Category ID is required'),
    name: z.string().min(2, 'Item name must be at least 2 characters'),
    description: z.string().optional(),
    price: z.number().positive('Price must be greater than 0'),
    image: z.string().url().optional().or(z.literal('')),
    preparationTime: z.number().int().min(0).optional(),
    isVeg: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid menu item ID'),
  }),
  body: z.object({
    categoryId: z.number().int().positive().optional(),
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    price: z.number().positive().optional(),
    image: z.string().url().optional().or(z.literal('')),
    preparationTime: z.number().int().min(0).optional(),
    isVeg: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>['body'];
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>['body'];
