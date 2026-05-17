import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function successResponse<T>(
  res: Response,
  data: T,
  statusCode = 200
): Response<ApiResponse<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function errorResponse(
  res: Response,
  error: string,
  statusCode = 400
): Response<ApiResponse> {
  return res.status(statusCode).json({
    success: false,
    error,
  });
}

export function messageResponse(
  res: Response,
  message: string,
  statusCode = 200
): Response<ApiResponse> {
  return res.status(statusCode).json({
    success: true,
    message,
  });
}

export function paginatedResponse<T>(
  res: Response,
  data: T,
  page: number,
  limit: number,
  total: number
): Response<ApiResponse<T>> {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function createdResponse<T>(
  res: Response,
  data: T
): Response<ApiResponse<T>> {
  return res.status(201).json({
    success: true,
    data,
  });
}

export function noContentResponse(res: Response): Response {
  return res.status(204).send();
}