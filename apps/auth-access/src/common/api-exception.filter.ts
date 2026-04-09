import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';


interface ErrorPayload {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}


@Catch()
export class ApiExceptionFilter implements ExceptionFilter {

  private readonly logger = new Logger(ApiExceptionFilter.name);


  catch(exception: unknown, host: ArgumentsHost): void {

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status(code: number): { send(body: unknown): void } }>();
    const request = ctx.getRequest<{ url?: string; method?: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException
        ? this.normalizeHttpException(exception, request.url ?? '')
        : this.internalServerError(request.url ?? '');

    if (!(exception instanceof HttpException) || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const message = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`${request.method ?? 'HTTP'} ${request.url ?? ''}`, message);
    }

    response.status(status).send(payload);
  }


  private normalizeHttpException(exception: HttpException, path: string): ErrorPayload {

    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const base: ErrorPayload = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message: exception.message,
      timestamp: new Date().toISOString(),
      path,
    };

    if (typeof response === 'string') {
      return { ...base, message: response };
    }

    if (response && typeof response === 'object') {
      const candidate = response as {
        error?: unknown;
        message?: unknown;
        details?: unknown;
      };

      if (typeof candidate.error === 'string') {
        base.error = candidate.error;
      }

      if (typeof candidate.message === 'string') {
        base.message = candidate.message;
      } else if (Array.isArray(candidate.message)) {
        base.message = statusCode === HttpStatus.BAD_REQUEST ? 'Validation failed' : base.message;
        base.details = candidate.message;
      }

      if (candidate.details !== undefined) {
        base.details = candidate.details;
      }
    }

    return base;
  }


  private internalServerError(path: string): ErrorPayload {

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path,
    };
  }
}
