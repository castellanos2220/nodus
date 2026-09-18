import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  requestId: string;
}

/**
 * Único punto de salida de errores de la API.
 *
 * Dos objetivos:
 *  1. **Forma estable**: todo error sale con `{ statusCode, code, message, ... }`,
 *     de modo que el frontend nunca tenga que adivinar.
 *  2. **No filtrar interioridades**: los errores de Prisma se traducen a códigos
 *     de negocio. Un `P2002` es "ya existe un registro con ese valor", no un
 *     volcado con nombres de columnas y constraints internos.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) ?? 'n/a';

    const body = this.toErrorBody(exception, request.url, requestId);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode} ${body.code}: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${body.statusCode} ${body.code}: ${body.message}`,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string, requestId: string): ErrorBody {
    const base = { path, timestamp: new Date().toISOString(), requestId };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;

        // Errores de validación de class-validator: `message` es un array.
        if (Array.isArray(record.message)) {
          return {
            ...base,
            statusCode: status,
            code: 'VALIDATION_ERROR',
            message: 'La solicitud contiene datos inválidos',
            details: record.message,
          };
        }

        return {
          ...base,
          statusCode: status,
          code: typeof record.code === 'string' ? record.code : this.defaultCode(status),
          message:
            typeof record.message === 'string' ? record.message : this.defaultMessage(status),
          details: record.details,
        };
      }

      return {
        ...base,
        statusCode: status,
        code: this.defaultCode(status),
        message: typeof payload === 'string' ? payload : this.defaultMessage(status),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...base, ...this.fromPrisma(exception) };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_QUERY',
        message: 'La consulta enviada no es válida',
      };
    }

    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
    };
  }

  private fromPrisma(
    error: Prisma.PrismaClientKnownRequestError,
  ): Pick<ErrorBody, 'statusCode' | 'code' | 'message' | 'details'> {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target : [target];

        // Los índices únicos parciales de la migración 002 son invariantes de
        // negocio: merecen un mensaje propio, no un "valor duplicado" genérico.
        const constraint = fields.join(',');
        if (constraint.includes('case_assignments_one_active_primary')) {
          return {
            statusCode: HttpStatus.CONFLICT,
            code: 'CASE_ALREADY_HAS_PRIMARY_CONSULTANT',
            message: 'El caso ya tiene un consultor responsable principal activo',
          };
        }
        if (constraint.includes('proposal_versions_one_draft')) {
          return {
            statusCode: HttpStatus.CONFLICT,
            code: 'PROPOSAL_DRAFT_ALREADY_EXISTS',
            message: 'La propuesta ya tiene una versión en borrador',
          };
        }

        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'DUPLICATE_RECORD',
          message: 'Ya existe un registro con esos datos',
          details: { fields },
        };
      }

      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'La operación referencia un registro que no existe',
        };

      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'No se encontró el registro solicitado',
        };

      default:
        // Los triggers de inmutabilidad (audit_logs, document_versions,
        // proposal_versions congeladas) llegan como P2010/raw query failed.
        if (typeof error.message === 'string' && error.message.includes('append-only')) {
          return {
            statusCode: HttpStatus.FORBIDDEN,
            code: 'APPEND_ONLY_VIOLATION',
            message: 'La bitácora de auditoría no admite modificación ni borrado',
          };
        }
        if (typeof error.message === 'string' && error.message.includes('congelada')) {
          return {
            statusCode: HttpStatus.CONFLICT,
            code: 'FROZEN_VERSION',
            message: 'La versión está congelada: cree una versión nueva',
          };
        }
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Error de base de datos',
        };
    }
  }

  private defaultCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return map[status] ?? 'ERROR';
  }

  private defaultMessage(status: number): string {
    const map: Record<number, string> = {
      400: 'Solicitud inválida',
      401: 'No autenticado',
      403: 'No tiene permisos para realizar esta acción',
      404: 'Recurso no encontrado',
      409: 'Conflicto con el estado actual del recurso',
      413: 'El contenido enviado supera el tamaño permitido',
      422: 'No se pudo procesar la solicitud',
      429: 'Demasiadas solicitudes; intente de nuevo más tarde',
    };
    return map[status] ?? 'Error';
  }
}
