import { z } from "zod";
import { httpsUrlSchema, idSchema, nameSchema } from "../../shared/application/schemas.js";
import {
  CREDENTIAL_STATUSES,
  MAX_STUDENTS_PER_EVIDENCE,
  MIN_STUDENTS_PER_EVIDENCE,
  type RegisterCredentialInput,
  type UpdateCredentialInput,
  type UpdateEvidenceInput,
  type UploadEvidenceInput,
} from "../domain/evidence.entity.js";

// Esquemas de entrada de evidencias y credenciales (nivel 1, ADR-001;
// docs/VALIDACIONES.md §3.10 y §3.12). Estudiantes activos, máximo por evidencia
// al relacionar, transiciones de credenciales y la regla del taller (nivel 2)
// siguen en los servicios.

const evidenceTitle = nameSchema(2, 150);

/** 1 a 50 estudiantes; los repetidos se cuentan una vez. */
const studentIds = z
  .array(idSchema, { error: "Debe ser una lista de ids de estudiantes" })
  .transform((ids) => [...new Set(ids)])
  .pipe(
    z
      .array(z.bigint())
      .min(MIN_STUDENTS_PER_EVIDENCE, `Debe tener al menos ${MIN_STUDENTS_PER_EVIDENCE} estudiante`)
      .max(MAX_STUDENTS_PER_EVIDENCE, `Debe tener como máximo ${MAX_STUDENTS_PER_EVIDENCE} estudiantes`),
  );

export const uploadEvidenceSchema = z.strictObject({
  url: httpsUrlSchema,
  title: evidenceTitle,
  studentIds,
}) satisfies z.ZodType<UploadEvidenceInput>;

export const updateEvidenceSchema = z.strictObject({
  url: httpsUrlSchema.exactOptional(),
  title: evidenceTitle.exactOptional(),
}) satisfies z.ZodType<UpdateEvidenceInput>;

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
