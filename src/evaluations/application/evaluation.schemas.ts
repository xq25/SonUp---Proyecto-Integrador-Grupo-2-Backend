import { z } from "zod";
import { idSchema, nameSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import type {
  CreateEvaluationScaleInput,
  EvaluateSkillInput,
  UpdateEvaluationScaleInput,
} from "../domain/evaluation.entity.js";
import { GRADE_MAX, GRADE_MIN } from "../domain/grading.js";

// Esquemas de entrada de escalas y evaluaciones (nivel 1, ADR-001;
// docs/VALIDACIONES.md §3.4 y §3.9). La coherencia entre campos
// (min ≤ num ≤ max sobre el resultado final), el no solapamiento, los valores
// fijos de una escala en uso y el estado del taller (nivel 2) siguen en el servicio.

/** Código: solo mayúsculas, números y `_`, de 1 a 30. No se normaliza: lo que no cumpla se rechaza. */
const scaleCode = z
  .string()
  .regex(/^[A-Z0-9_]{1,30}$/, "El código solo admite mayúsculas (A-Z), números y _, de 1 a 30 caracteres");

/** Calificación: número en el rango global 0–5, con máximo 2 decimales (numeric(5,2)). */
const gradeValue = z
  .number({ error: "Debe ser un número" })
  .min(GRADE_MIN, `Debe estar entre ${GRADE_MIN} y ${GRADE_MAX}`)
  .max(GRADE_MAX, `Debe estar entre ${GRADE_MIN} y ${GRADE_MAX}`)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, "Admite como máximo 2 decimales");

const scaleName = nameSchema(2, 100);
const scaleDescription = optionalTextSchema(500);

export const createEvaluationScaleSchema = z.strictObject({
  code: scaleCode,
  name: scaleName,
  description: scaleDescription.exactOptional(),
  numValue: gradeValue,
  minValue: gradeValue,
  maxValue: gradeValue,
  isActive: z.boolean({ error: "Debe ser verdadero o falso" }).exactOptional(),
}) satisfies z.ZodType<CreateEvaluationScaleInput>;

export const updateEvaluationScaleSchema = z.strictObject({
  code: scaleCode.exactOptional(),
  name: scaleName.exactOptional(),
  description: scaleDescription.exactOptional(),
  numValue: gradeValue.exactOptional(),
  minValue: gradeValue.exactOptional(),
  maxValue: gradeValue.exactOptional(),
  isActive: z.boolean({ error: "Debe ser verdadero o falso" }).exactOptional(),
}) satisfies z.ZodType<UpdateEvaluationScaleInput>;

export const evaluateSkillSchema = z.strictObject({
  workshopAttendanceId: idSchema,
  workshopSkillId: idSchema,
  evaluationScaleId: idSchema,
}) satisfies z.ZodType<EvaluateSkillInput>;
