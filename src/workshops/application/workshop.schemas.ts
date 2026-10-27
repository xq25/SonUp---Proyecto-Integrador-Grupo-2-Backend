import { z } from "zod";
import { dateTimeSchema, idSchema, nameSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import {
  type CreateWorkshopInput,
  type RegisterAttendanceInput,
  type UpdateAttendanceInput,
  type UpdateWorkshopInput,
  WORKSHOP_STATUSES,
} from "../domain/workshop.entity.js";

// Esquemas de entrada de talleres y asistencias (nivel 1, ADR-001).
// Solo validan la FORMA (docs/VALIDACIONES.md §3.6 y §3.8); las reglas de
// negocio (transiciones, fechas por estado, una asistencia por día…) siguen
// en los servicios y en `*.rules.ts`.
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

const observation = optionalTextSchema(1000);

/** §3.8: `attendedAt` por defecto es ahora (lo asigna el servicio). */
export const registerAttendanceSchema = z.strictObject({
  studentId: idSchema,
  workshopId: idSchema,
  attendedAt: dateTimeSchema.exactOptional(),
  observation: observation.exactOptional(),
}) satisfies z.ZodType<RegisterAttendanceInput>;

export const updateAttendanceSchema = z.strictObject({
  attendedAt: dateTimeSchema.exactOptional(),
  observation: observation.exactOptional(),
}) satisfies z.ZodType<UpdateAttendanceInput>;
