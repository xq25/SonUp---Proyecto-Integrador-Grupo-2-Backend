import { z } from "zod";
import { nameSchema } from "../../shared/application/schemas.js";
import type { CreateAppInput } from "../domain/app.entity.js";
import { catalogCodeSchema } from "./catalog-code.schema.js";

// Esquemas de entrada de aplicaciones (nivel 1, ADR-001; propuesta de VALIDACIONES.md §4).
// La unicidad del código (nivel 2) sigue en el servicio.

export const createAppSchema = z.strictObject({
  code: catalogCodeSchema,
  name: nameSchema(2, 100),
}) satisfies z.ZodType<CreateAppInput>;
