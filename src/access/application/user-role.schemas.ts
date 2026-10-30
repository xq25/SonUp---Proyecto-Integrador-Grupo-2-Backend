import { z } from "zod";
import { uuidSchema } from "../../shared/application/schemas.js";
import type { AssignRoleInput } from "../domain/user-role.entity.js";
import { catalogCodeSchema } from "./catalog-code.schema.js";

// Esquemas de entrada de roles de usuario (nivel 1, ADR-001; propuesta de VALIDACIONES.md §4).
// La existencia del perfil, el rol y la aplicación (nivel 2) sigue en el servicio.

export const assignRoleSchema = z.strictObject({
  userId: uuidSchema,
  role: catalogCodeSchema,
  /** null = rol global (aplica en todas las aplicaciones). */
  app: catalogCodeSchema.nullable().exactOptional(),
}) satisfies z.ZodType<AssignRoleInput>;
