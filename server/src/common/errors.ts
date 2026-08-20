/**
 * Domain errors carry a stable `code` alongside the message.
 *
 * The code — not the prose — is what clients branch on: the portal translates it via
 * `errors.<code>` and a packaged mini app decides whether to show its key prompt. Messages
 * are for humans and may be reworded freely; codes are API surface, so treat them as such.
 */

import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ detail: message, code }, status);
  }
}

/* Thin constructors so call sites read as the status they mean. */

export class BadRequestError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.CONFLICT);
  }
}

export class TooManyRequestsError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class UnprocessableError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class ServiceUnavailableError extends AppException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
