import { z } from "zod";
import { dateTimeSchema, idSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import type { RegisterAttendanceInput, UpdateAttendanceInput } from "../domain/workshop-attendance.entity.js";

// Esquemas de entrada de asistencias (nivel 1, ADR-001).
// Solo validan la FORMA (docs/VALIDACIONES.md §3.8); las reglas de negocio
// (taller activo, una asistencia por día…) siguen en el servicio y en `attendance.rules.ts`.

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
