import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^(\d{10}|\+?[1-9]\d{1,14})$/, 'Invalid phone number');

export const getStaffSchema = z.object({
  query: z.object({
    role: z.enum(['waiter', 'cook', 'cashier']).optional(),
  }),
});

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: phoneSchema,
    pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
    role: z.enum(['waiter', 'cook', 'cashier']),
    isActive: z.boolean().optional(),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid staff ID'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
    role: z.enum(['waiter', 'cook', 'cashier']).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deleteStaffSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid staff ID'),
  }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>['body'];
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>['body'];
