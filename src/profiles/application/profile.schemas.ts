import { z } from "zod";
import {
  dateTimeSchema,
  documentNumberSchema,
  documentTypeSchema,
  nameSchema,
  phoneSchema,
} from "../../shared/application/schemas.js";
import { PROFILE_STATUSES, type UpdateProfileInput } from "../domain/profile.entity.js";

// Esquema de entrada de perfiles (nivel 1, ADR-001). Tabla heredada del script
// de login: reglas según la PROPUESTA de docs/VALIDACIONES.md §4 (pendiente de
// revisión tabla por tabla). La unicidad del documento (nivel 2) sigue en el servicio.
// Los perfiles no se crean aquí: los crea el trigger `crear_perfil`.

export const updateProfileSchema = z.strictObject({
  firstNames: nameSchema(1, 100).exactOptional(),
  lastNames: nameSchema(1, 100).nullable().exactOptional(),
  phone: phoneSchema.nullable().exactOptional(),
  documentType: documentTypeSchema.nullable().exactOptional(),
  documentNumber: documentNumberSchema.nullable().exactOptional(),
  status: z.enum(PROFILE_STATUSES, { error: `Debe ser uno de: ${PROFILE_STATUSES.join(", ")}` }).exactOptional(),
  dataProcessingAcceptedAt: dateTimeSchema.nullable().exactOptional(),
}) satisfies z.ZodType<UpdateProfileInput>;
