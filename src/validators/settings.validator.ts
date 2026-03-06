import { z } from 'zod';

export const updateRestaurantInfoSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Restaurant name must be at least 2 characters').optional(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
    email: z.string().email('Invalid email address').optional(),
    address: z.string().optional(),
    logoUrl: z.string().url('Invalid logo URL').optional(),
  }),
});

export const updateRestaurantSettingsSchema = z.object({
  body: z.object({
    currency: z.string().min(1, 'Currency is required').optional(),
    taxPercentage: z.number().min(0).max(100).optional(),
    operatingHours: z.object({
      monday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
      tuesday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
      wednesday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
      thursday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
      friday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
      saturday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
      sunday: z.object({
        open: z.string().optional(),
        close: z.string().optional(),
      }).optional(),
    }).optional(),
    features: z.object({
      tableService: z.boolean().optional(),
      parcelOrders: z.boolean().optional(),
      onlineOrders: z.boolean().optional(),
    }).optional(),
  }),
});

export type UpdateRestaurantInfoInput = z.infer<typeof updateRestaurantInfoSchema>['body'];
export type UpdateRestaurantSettingsInput = z.infer<typeof updateRestaurantSettingsSchema>['body'];
