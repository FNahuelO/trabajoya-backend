export class ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  meta?: any;
}

export function createResponse<T>({
  success,
  message,
  data,
  error,
  meta,
}: {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  meta?: any;
}): ApiResponse<T> {
  return {
    success,
    message,
    data,
    error,
    meta,
  };
}
