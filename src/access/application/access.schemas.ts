import { z } from "zod";
import { nameSchema, uuidSchema } from "../../shared/application/schemas.js";
import type { AssignRoleInput, CreateCatalogInput } from "../domain/access.entity.js";

// Esquemas de entrada de acceso (nivel 1, ADR-001). Tablas heredadas del script
// de login: reglas según la PROPUESTA de docs/VALIDACIONES.md §4 (pendiente de
// revisión tabla por tabla). Unicidad y existencia (nivel 2) siguen en el servicio.

/** Código de rol o aplicación: 2–30 letras, números o `_` (p. ej. "aula_up", "asisConnection"). */
const catalogCode = z
  .string()
  .regex(/^[a-zA-Z0-9_]{2,30}$/, "El código solo admite letras, números y _, de 2 a 30 caracteres");

export const createCatalogSchema = z.strictObject({
  code: catalogCode,
  name: nameSchema(2, 100),
}) satisfies z.ZodType<CreateCatalogInput>;

export const assignRoleSchema = z.strictObject({
  userId: uuidSchema,
  role: catalogCode,
  /** null = rol global (aplica en todas las aplicaciones). */
  app: catalogCode.nullable().exactOptional(),
}) satisfies z.ZodType<AssignRoleInput>;
