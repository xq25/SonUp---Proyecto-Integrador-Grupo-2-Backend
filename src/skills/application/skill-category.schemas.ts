import { z } from "zod";
import { nameSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import type { CreateSkillCategoryInput, UpdateSkillCategoryInput } from "../domain/skill-category.entity.js";

// Esquemas de entrada de categorías (nivel 1, ADR-001; docs/VALIDACIONES.md §3.2).
// La unicidad del nombre y la regla de borrado (nivel 2) siguen en el servicio.

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
