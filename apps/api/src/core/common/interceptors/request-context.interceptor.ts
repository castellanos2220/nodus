import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Asigna un `x-request-id` a cada petición si el cliente no trae uno.
 *
 * Ese identificador viaja al log estructurado, al cuerpo de los errores y a la
 * columna `requestId` de la bitácora de auditoría: dado un error que ve un
 * usuario, se puede reconstruir exactamente qué hizo el sistema.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
