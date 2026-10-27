import { DomainError } from "../domain/errors.js";

/** Errores propios de la capa HTTP (autenticación). Los servicios no los conocen. */
export class UnauthorizedError extends DomainError {
  constructor(message: string) {
    super(message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message, "FORBIDDEN");
  }
}
