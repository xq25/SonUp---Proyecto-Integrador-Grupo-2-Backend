import type { ErrorRequestHandler, RequestHandler } from "express";
import { ConflictError, DomainError, NotFoundError, ValidationError } from "../domain/errors.js";
import { ForbiddenError, UnauthorizedError } from "./http-errors.js";

// Traducción de errores a HTTP (ADR-002 §2.4). Formato único:
// { "error": { "code", "message", "details"? } }

function statusOf(error: DomainError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  return 400;
}

/** Errores de `express.json()` (JSON mal formado, cuerpo muy grande…). */
interface BodyParserError {
  type: string;
  status: number;
}

const isBodyParserError = (error: unknown): error is BodyParserError =>
  typeof error === "object" &&
  error !== null &&
  typeof (error as BodyParserError).type === "string" &&
  typeof (error as BodyParserError).status === "number";

const bodyParserMessages: Record<string, string> = {
  "entity.parse.failed": "El cuerpo no es un JSON válido",
  "entity.too.large": "El cuerpo es demasiado grande",
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `La ruta ${req.method} ${req.path} no existe` } });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof DomainError) {
    const details = error instanceof ValidationError && error.details.length > 0 ? { details: error.details } : {};
    res.status(statusOf(error)).json({ error: { code: error.code, message: error.message, ...details } });
    return;
  }
  if (isBodyParserError(error) && error.status >= 400 && error.status < 500) {
    const message = bodyParserMessages[error.type] ?? "Cuerpo de la petición inválido";
    res.status(error.status).json({ error: { code: "BAD_REQUEST", message } });
    return;
  }
  // Error inesperado: se registra completo, pero no se exponen detalles internos.
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL", message: "Error interno del servidor" } });
};
