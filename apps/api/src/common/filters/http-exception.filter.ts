import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { AppError } from '@kincare/shared';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      return res.status(exception.status).json({
        error: { code: exception.code, message: exception.message, details: exception.details },
      });
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return res.status(status).json({
        error: typeof body === 'string'
          ? { code: HttpStatus[status] ?? 'ERROR', message: body }
          : body,
      });
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}
