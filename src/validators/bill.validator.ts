import { z } from 'zod';

export const listBillsSchema = z.object({
  query: z.object({
    paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
  }),
});

export const getBillSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid bill ID'),
  }),
});

export const getBillByOrderSchema = z.object({
  params: z.object({
    orderId: z.string().regex(/^\d+$/, 'Invalid order ID'),
  }),
});

export const generateBillSchema = z.object({
  params: z.object({
    orderId: z.string().regex(/^\d+$/, 'Invalid order ID'),
  }),
  body: z.object({
    discountAmount: z.number().min(0).optional(),
  }).optional(),
});

export const recordPaymentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid bill ID'),
  }),
  body: z.object({
    amount: z.number().positive().optional(),
    paymentMethod: z.enum(['cash', 'card', 'upi', 'other']),
    transactionId: z.string().optional(),
    status: z.enum(['success', 'failed', 'pending']).optional(),
  }),
});

export type ListBillsInput = z.infer<typeof listBillsSchema>['query'];
export type GenerateBillInput = z.infer<typeof generateBillSchema>['body'];
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>['body'];
