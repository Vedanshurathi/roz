import type { ApiErrorCode } from '@rozbazaar/shared';

/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const unauthenticated = (message = 'Please log in again') =>
  new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'Not allowed') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
/** The database refused for a business reason (slot full, wrong code…). The message is user-facing. */
export const businessRule = (message: string, details?: unknown) =>
  new AppError(422, 'BUSINESS_RULE', message, details);
export const upstream = (message = 'Service is busy, please try again') =>
  new AppError(502, 'UPSTREAM', message);
