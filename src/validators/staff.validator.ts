import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^(\d{10}|\+?[1-9]\d{1,14})$/, 'Invalid phone number');

export const getStaffSchema = z.object({
  query: z.object({
    role: z.enum(['waiter', 'cook']).optional(),
  }),
});

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: phoneSchema,
    pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
    role: z.enum(['waiter', 'cook']),
    isActive: z.boolean().optional(),
    firebaseIdToken: z.string().min(1, 'Firebase token is required for OTP verification'),
  }),
});

export const forgotStaffPinSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid staff ID'),
  }),
  body: z.object({
    newPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
    firebaseIdToken: z.string().min(1, 'Firebase token is required for OTP verification'),
  }),
});

export const resetStaffPinSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid staff ID'),
  }),
  body: z.object({
    currentPin: z.string().regex(/^\d{4,6}$/, 'Current PIN must be 4-6 digits'),
    newPin: z.string().regex(/^\d{4,6}$/, 'New PIN must be 4-6 digits'),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid staff ID'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
    role: z.enum(['waiter', 'cook']).optional(),
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
export type ForgotStaffPinInput = z.infer<typeof forgotStaffPinSchema>['body'];
export type ResetStaffPinInput = z.infer<typeof resetStaffPinSchema>['body'];
