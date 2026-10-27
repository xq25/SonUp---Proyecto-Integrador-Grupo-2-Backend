import { z } from "zod";
import { idSchema, nameSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import {
  type CreateSkillCategoryInput,
  type CreateSkillInput,
  SKILL_STATUSES,
  type UpdateSkillCategoryInput,
  type UpdateSkillInput,
} from "../domain/skill.entity.js";

// Esquemas de entrada de categorías y habilidades (nivel 1, ADR-001;
// docs/VALIDACIONES.md §3.2 y §3.3). La unicidad de nombres y las reglas de
// borrado (nivel 2) siguen en el servicio.

const categoryName = nameSchema(2, 100);
const categoryDescription = optionalTextSchema(500);

export const createSkillCategorySchema = z.strictObject({
  name: categoryName,
  description: categoryDescription.exactOptional(),
}) satisfies z.ZodType<CreateSkillCategoryInput>;

export const updateSkillCategorySchema = z.strictObject({
  name: categoryName.exactOptional(),
  description: categoryDescription.exactOptional(),
}) satisfies z.ZodType<UpdateSkillCategoryInput>;

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
