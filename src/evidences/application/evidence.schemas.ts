import { z } from "zod";
import { httpsUrlSchema, idSchema, nameSchema } from "../../shared/application/schemas.js";
import {
  MAX_STUDENTS_PER_EVIDENCE,
  MIN_STUDENTS_PER_EVIDENCE,
  type UpdateEvidenceInput,
  type UploadEvidenceInput,
} from "../domain/evidence.entity.js";

// Esquemas de entrada de evidencias (nivel 1, ADR-001; docs/VALIDACIONES.md §3.10).
// Estudiantes activos y el máximo por evidencia al relacionar (nivel 2) siguen en el servicio.

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
