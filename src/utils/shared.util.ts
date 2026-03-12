import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

/**
 * Shared utility: parse a route param to an integer.
 * Used across all controllers to avoid duplication.
 */
export const parseId = (value: string | string[]): number =>
  parseInt(String(value), 10);

/** Pagination parameters extracted from query string. */
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Shared utility: extract pagination params from a request query string.
 * Defaults to page=1, limit=50. Clamps limit to [1, 100].
 * Backwards-compatible — callers that omit page/limit get sensible defaults.
 */
export function parsePagination(req: Request, defaultLimit = 50): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Shared utility: get the tax percentage for a restaurant (as a number 0-100).
 * Handles both `taxPercentage` (camelCase) and `tax_percentage` (snake_case)
 * key names in the settings JSON for backwards compatibility.
 *
 * Accepts an optional Prisma transaction client so it can be called safely
 * inside interactive transactions without acquiring a second pool connection.
 */
export async function getTaxPercentage(restaurantId: number, client: any = prisma): Promise<number> {
  const restaurant = await client.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  });
  const settings = restaurant?.settings as any;
  const pct = Number(settings?.taxPercentage ?? settings?.tax_percentage ?? 5);
  return Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 5;
}

/**
 * Shared utility: get the tax rate as a Prisma.Decimal fraction (e.g. 0.05 for 5%).
 * Used by order.service for Decimal-based arithmetic.
 *
 * Accepts an optional Prisma transaction client so it can be called safely
 * inside interactive transactions without acquiring a second pool connection.
 */
export async function getTaxRateDecimal(restaurantId: number, client: any = prisma): Promise<Prisma.Decimal> {
  const pct = await getTaxPercentage(restaurantId, client);
  return new Prisma.Decimal(pct).div(100);
}

/**
 * Shared utility: fetch consolidated billing orders for a table.
 * Used by bill.service in multiple methods.
 */
export async function getConsolidatedBillingOrders(
  tableId: number | null,
  restaurantId: number,
  fallbackOrder: any
) {
  if (!tableId) return [fallbackOrder];

  return prisma.order.findMany({
    where: {
      tableId,
      restaurantId,
      status: 'billing',
    },
    include: {
      items: { include: { menuItem: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}
