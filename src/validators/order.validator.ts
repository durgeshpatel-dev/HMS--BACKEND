import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    tableId: z.number().int().positive().optional(),
    orderType: z.enum(['dine_in', 'parcel']),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    specialNotes: z.string().optional(),
    items: z.array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1),
        customizations: z.record(z.string(), z.unknown()).optional(),
      })
    ).min(1),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed', 'cancelled']).optional(),
    kitchenStatus: z.enum(['pending', 'preparing', 'ready']).optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    specialNotes: z.string().optional(),
  }),
});

export const addOrderItemsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    items: z.array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1),
        customizations: z.record(z.string(), z.unknown()).optional(),
      })
    ).min(1),
  }),
});

export const updateOrderItemSchema = z.object({
  params: z.object({
    orderId: z.string().regex(/^\d+$/),
    itemId: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    quantity: z.number().int().min(1).optional(),
    customizations: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>['body'];
export type AddOrderItemsInput = z.infer<typeof addOrderItemsSchema>['body'];
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>['body'];
