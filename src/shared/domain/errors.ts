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
