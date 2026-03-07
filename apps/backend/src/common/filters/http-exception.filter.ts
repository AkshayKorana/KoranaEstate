import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const payload = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' }

    const isDevelopment = process.env.NODE_ENV !== 'production'
    const shouldLog = status >= 500 || isDevelopment

    if (shouldLog) {
      const message =
        exception instanceof Error
          ? exception.message
          : typeof payload === 'string'
            ? payload
            : JSON.stringify(payload)
      const stack = exception instanceof Error ? exception.stack : undefined
      this.logger.error(
        `${request.method} ${request.url} failed with status=${status}: ${message}`,
        stack,
      )
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: payload,
    })
  }
}
