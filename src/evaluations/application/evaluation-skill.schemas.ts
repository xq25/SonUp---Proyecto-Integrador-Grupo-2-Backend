import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import type { EvaluateSkillInput } from "../domain/evaluation-skill.entity.js";

// Esquema de entrada de evaluaciones (nivel 1, ADR-001; docs/VALIDACIONES.md §3.9).
// El estado del taller, el estudiante activo y la escala activa (nivel 2) siguen en el servicio.

export const evaluateSkillSchema = z.strictObject({
  workshopAttendanceId: idSchema,
  workshopSkillId: idSchema,
  evaluationScaleId: idSchema,
}) satisfies z.ZodType<EvaluateSkillInput>;
