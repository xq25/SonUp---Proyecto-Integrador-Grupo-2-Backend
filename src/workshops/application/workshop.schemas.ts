import { z } from "zod";
import { dateTimeSchema, idSchema, nameSchema } from "../../shared/application/schemas.js";
import { type CreateWorkshopInput, type UpdateWorkshopInput, WORKSHOP_STATUSES } from "../domain/workshop.entity.js";

// Esquemas de entrada de talleres (nivel 1, ADR-001).
// Solo validan la FORMA (docs/VALIDACIONES.md §3.6); las reglas de negocio
// (transiciones, fechas por estado…) siguen en el servicio y en `workshop.rules.ts`.
// `satisfies z.ZodType<DTO>` obliga a que el esquema produzca exactamente el
// DTO del dominio, sin que el dominio dependa de Zod.

const workshopName = nameSchema(3, 150);
const workshopStatus = z.enum(WORKSHOP_STATUSES, { error: `Debe ser uno de: ${WORKSHOP_STATUSES.join(", ")}` });

/** §3.6: todo taller nace `planned`. */
export const createWorkshopSchema = z.strictObject({
  evaluatorId: idSchema,
  name: workshopName,
  startsAt: dateTimeSchema.nullable().exactOptional(),
  endsAt: dateTimeSchema.nullable().exactOptional(),
  status: z.literal("planned", { error: 'Un taller siempre se crea "planned"' }).exactOptional(),
}) satisfies z.ZodType<CreateWorkshopInput>;

export const updateWorkshopSchema = z.strictObject({
  evaluatorId: idSchema.exactOptional(),
  name: workshopName.exactOptional(),
  startsAt: dateTimeSchema.nullable().exactOptional(),
  endsAt: dateTimeSchema.nullable().exactOptional(),
  status: workshopStatus.exactOptional(),
}) satisfies z.ZodType<UpdateWorkshopInput>;
