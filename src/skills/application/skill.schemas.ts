import { z } from "zod";
import { idSchema, nameSchema } from "../../shared/application/schemas.js";
import { type CreateSkillInput, SKILL_STATUSES, type UpdateSkillInput } from "../domain/skill.entity.js";

// Esquemas de entrada de habilidades (nivel 1, ADR-001; docs/VALIDACIONES.md §3.3).
// La unicidad del nombre por categoría y la regla de borrado (nivel 2) siguen en el servicio.

const skillName = nameSchema(2, 100);
const skillStatus = z.enum(SKILL_STATUSES, { error: `Debe ser uno de: ${SKILL_STATUSES.join(", ")}` });

export const createSkillSchema = z.strictObject({
  name: skillName,
  skillCategoryId: idSchema,
  status: skillStatus.exactOptional(),
}) satisfies z.ZodType<CreateSkillInput>;

export const updateSkillSchema = z.strictObject({
  name: skillName.exactOptional(),
  skillCategoryId: idSchema.exactOptional(),
  status: skillStatus.exactOptional(),
}) satisfies z.ZodType<UpdateSkillInput>;
