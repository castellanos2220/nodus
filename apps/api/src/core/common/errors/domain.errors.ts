import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Errores de dominio con **código estable**.
 *
 * El código (`GUARD_CHECKLIST_INCOMPLETE`, `COMPANY_DUPLICATE_MATCH`, …) es parte
 * del contrato de la API: el frontend lo usa para decidir qué mostrar, y no
 * depende de la redacción del mensaje. El mensaje va en español porque lo lee
 * una persona.
 */
export class DomainError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

/** 409 — el estado actual del sistema no permite la operación. */
export class BusinessRuleError extends DomainError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** 422 — la petición es sintácticamente válida pero semánticamente imposible. */
export class UnprocessableError extends DomainError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/** 404 */
export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `No se encontró ${entity} con id ${id}` : `No se encontró ${entity}`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/** 403 — autenticado, pero sin autorización sobre este recurso o esta acción. */
export class ForbiddenError extends DomainError {
  constructor(message: string, code = 'FORBIDDEN', details?: unknown) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

/** 401 */
export class UnauthorizedError extends DomainError {
  constructor(message = 'Credenciales inválidas', code = 'UNAUTHORIZED') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

/** 400 */
export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown, code = 'VALIDATION_ERROR') {
    super(code, message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * Error lanzado por un guard del motor de workflow. Lleva siempre un código
 * `GUARD_*` para que `GET /cases/:id` pueda explicar qué falta para avanzar.
 */
export class WorkflowGuardError extends BusinessRuleError {
  constructor(
    readonly guardCode: string,
    message: string,
    details?: unknown,
  ) {
    super(guardCode, message, details);
  }
}

/** Transición inexistente desde el estado actual. */
export class InvalidTransitionError extends BusinessRuleError {
  constructor(from: string, code: string) {
    super(
      'INVALID_TRANSITION',
      `La transición ${code} no está permitida desde el estado ${from}`,
      { from, transition: code },
    );
  }
}
