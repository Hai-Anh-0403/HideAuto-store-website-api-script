/**
 * One error envelope for the whole API: `{ detail, code }`.
 *
 * Nest's default body varies by how the exception was constructed (`message` as a string,
 * an array from the ValidationPipe, or a nested object), which leaves clients string-matching
 * prose. Normalizing here means the portal can always translate `errors.<code>` and fall
 * back to `detail`, and a packaged mini app can branch on the code alone.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  detail: string;
  code: string | null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = this.normalize(exception);
      // 5xx from an HttpException is still a server fault worth a log line.
      if (status >= 500) this.logger.error(`${status} ${body.detail}`);
      res.status(status).json(body);
      return;
    }

    // Anything else escaped a service: log the real error, tell the client nothing.
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      detail: 'Internal server error',
      code: null,
    } satisfies ErrorBody);
  }

  private normalize(exception: HttpException): ErrorBody {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { detail: payload, code: null };
    }

    const obj = payload as Record<string, unknown>;
    const code = typeof obj.code === 'string' ? obj.code : null;

    // Already our shape.
    if (typeof obj.detail === 'string') {
      return { detail: obj.detail, code };
    }

    // Nest's default: `message` is a string, or an array from the ValidationPipe.
    const message = obj.message;
    if (Array.isArray(message)) {
      return {
        detail: message.filter((m) => typeof m === 'string').join('; '),
        code: code ?? 'validation_failed',
      };
    }
    if (typeof message === 'string') {
      return { detail: message, code };
    }

    return { detail: exception.message, code };
  }
}
