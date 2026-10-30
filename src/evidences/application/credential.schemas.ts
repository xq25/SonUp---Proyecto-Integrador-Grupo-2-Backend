import { z } from "zod";
import { httpsUrlSchema, idSchema, nameSchema } from "../../shared/application/schemas.js";
import {
  CREDENTIAL_STATUSES,
  type RegisterCredentialInput,
  type UpdateCredentialInput,
} from "../domain/credential.entity.js";

// Esquemas de entrada de credenciales (nivel 1, ADR-001; docs/VALIDACIONES.md §3.12).
// Las transiciones de estado y la regla del taller (nivel 2) siguen en el servicio.

const organizationName = nameSchema(2, 150);

/** §3.12: toda credencial nace `pending`. */
export const registerCredentialSchema = z.strictObject({
  studentId: idSchema,
  organizationName,
  workshopId: idSchema.nullable().exactOptional(),
  url: httpsUrlSchema,
  status: z.literal("pending", { error: 'Una credencial siempre se registra "pending"' }).exactOptional(),
}) satisfies z.ZodType<RegisterCredentialInput>;

export const updateCredentialSchema = z.strictObject({
  organizationName: organizationName.exactOptional(),
  workshopId: idSchema.nullable().exactOptional(),
  url: httpsUrlSchema.exactOptional(),
  status: z
    .enum(CREDENTIAL_STATUSES, { error: `Debe ser uno de: ${CREDENTIAL_STATUSES.join(", ")}` })
    .exactOptional(),
}) satisfies z.ZodType<UpdateCredentialInput>;
