import type { Request, Response } from "express";
import { z } from "zod";
import { idSchema, uuidSchema } from "../application/schemas.js";
import { parseInput } from "../application/validation.js";
import type { ActorId } from "../domain/auditable.js";

// Lectura de la parte de la petición que no es el cuerpo (ADR-002 §4):
// los parámetros de ruta y de consulta se validan aquí con Zod; el cuerpo
// va tal cual al servicio, que lo valida con su propio esquema (ADR-001).

/** Valida los parámetros de ruta (`/workshops/:id`). */
export function readParams<S extends z.ZodType>(schema: S, req: Request): z.output<S> {
  return parseInput(schema, req.params, "Parámetros de ruta");
}

/** Valida los parámetros de consulta (`?status=active`). Los desconocidos se rechazan. */
export function readQuery<S extends z.ZodType>(schema: S, req: Request): z.output<S> {
  return parseInput(schema, req.query, "Parámetros de consulta");
}

/** Actor (perfil) autenticado; lo deja `authenticate` en `res.locals`. */
export function actorOf(res: Response): ActorId {
  return res.locals["actor"] as ActorId;
}

// ── Esquemas reutilizables ──

/** `/:id` numérico (bigint). */
export const idParams = z.object({ id: idSchema });
/** `/:id` UUID (perfiles). */
export const uuidParams = z.object({ id: uuidSchema });
/** `/students/:studentId/...` */
export const studentParams = z.object({ studentId: idSchema });

/** Booleano en la consulta: solo `true` o `false`. */
export const booleanQuery = z
  .enum(["true", "false"], { error: "Debe ser true o false" })
  .transform((value) => value === "true");

/** Texto de búsqueda en la consulta. */
export const searchQuery = z.string().trim().min(1, "No puede estar vacío").max(100);

/** `?activeOnly=false` (por defecto true). */
export const activeOnlyQuery = z.strictObject({ activeOnly: booleanQuery.exactOptional() });
