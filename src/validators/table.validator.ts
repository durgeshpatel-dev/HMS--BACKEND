import { z } from 'zod';

export const createTableSchema = z.object({
  body: z.object({
    tableNumber: z.string().min(1, 'Table number is required'),
    capacity: z.number().int().min(1, 'Capacity must be at least 1'),
    location: z.string().optional(),
    qrCode: z.string().optional(),
  }),
});

export const updateTableSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid table ID'),
  }),
  body: z.object({
    tableNumber: z.string().min(1).optional(),
    capacity: z.number().int().min(1).optional(),
    status: z.enum(['available', 'occupied', 'reserved', 'billing', 'cleaning']).optional(),
    location: z.string().optional(),
    qrCode: z.string().optional(),
  }),
});

export const updateTableStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid table ID'),
  }),
  body: z.object({
    status: z.enum(['available', 'occupied', 'reserved', 'billing', 'cleaning']),
  }),
});

export type CreateTableInput = z.infer<typeof createTableSchema>['body'];
export type UpdateTableInput = z.infer<typeof updateTableSchema>['body'];
export type UpdateTableStatusInput = z.infer<typeof updateTableStatusSchema>['body'];
