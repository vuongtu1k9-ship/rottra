export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  message?: string | undefined;
  details?: unknown | undefined;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown | undefined;
}

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function fail(error: string, details?: unknown): ApiResponse<never> {
  return { success: false, error, details };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return { success: true, data: items, total, page, limit };
}
