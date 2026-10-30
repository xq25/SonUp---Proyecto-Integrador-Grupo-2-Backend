/**
 * Errores de dominio. Las capas de aplicación y dominio solo conocen estos
 * errores; la infraestructura traduce los errores propios del ORM a ellos.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string | bigint) {
    super(
      id === undefined ? `${entity} no existe` : `${entity} con id "${String(id)}" no existe`,
      "NOT_FOUND",
    );
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

/** Problema de validación de un campo concreto (`path` = ruta del campo, p. ej. "name" o "studentIds.2"). */
export interface FieldIssue {
  path: string;
  message: string;
}

export class ValidationError extends DomainError {
  /** Detalle por campo cuando el error viene de un esquema de entrada (nivel 1). */
  readonly details: readonly FieldIssue[];

  constructor(message: string, details: readonly FieldIssue[] = []) {
    super(message, "VALIDATION");
    this.details = details;
  }
}

/** Falta autenticación o no es válida (sesión inválida o vencida, credenciales incorrectas). */
export class UnauthorizedError extends DomainError {
  constructor(message: string) {
    super(message, "UNAUTHORIZED");
  }
}

/** Autenticado, pero sin permiso para la operación. */
export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message, "FORBIDDEN");
  }
}

/** Por qué falló un servicio externo (p. ej. el de autenticación del módulo administrativo). */
export type ExternalServiceFailure = "not_configured" | "unavailable" | "timeout" | "rate_limited" | "bad_response";

/** Un servicio externo no respondió o respondió algo que no se puede usar. */
export class ExternalServiceError extends DomainError {
  readonly failure: ExternalServiceFailure;

  constructor(message: string, failure: ExternalServiceFailure) {
    super(message, "EXTERNAL_SERVICE");
    this.failure = failure;
  }
}
