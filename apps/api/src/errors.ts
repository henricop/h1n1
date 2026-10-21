/**
 * Erros da API: sempre { error: { code, message } }, nunca stack trace.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (message: string) => new ApiError(404, 'not_found', message);
export const badRequest = (message: string) => new ApiError(400, 'validation_error', message);
/** Resultado cortado pelo limite de linhas: uma análise sobre série incompleta seria enganosa. */
export const tooManyRows = (message: string) => new ApiError(400, 'too_many_rows', message);

export interface ErrorBody {
  error: { code: string; message: string };
}

export function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}
