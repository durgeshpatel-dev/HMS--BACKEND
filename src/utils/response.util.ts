import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
  };

  if (message) response.message = message;
  if (data !== undefined) response.data = data;

  return res.status(statusCode).json(response);
};

/**
 * Send a paginated success response.
 * Returns { success, message, data, pagination: { page, limit, total, totalPages } }
 */
export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string,
): Response => {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  if (message) response.message = message;

  return res.status(200).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: any[]
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) response.errors = errors;

  return res.status(statusCode).json(response);
};
