import { z } from "zod";
import { idSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import type { RegisterAttendanceInput, UpdateAttendanceInput } from "../domain/workshop-attendance.entity.js";

// Esquemas de entrada de asistencias (nivel 1, ADR-001).
// Solo validan la FORMA (docs/VALIDACIONES.md §3.8 y §3.13); las reglas de negocio
// (sesión en curso, una asistencia por sesión…) siguen en el servicio y en `attendance.rules.ts`.

const observation = optionalTextSchema(1000);

/** La sesión define el taller y la fecha (ADR-009): no se reciben `workshopId` ni `attendedAt`. */
export const registerAttendanceSchema = z.strictObject({
  sessionId: idSchema,
  studentId: idSchema,
  observation: observation.exactOptional(),
}) satisfies z.ZodType<RegisterAttendanceInput>;

export const updateAttendanceSchema = z.strictObject({
  observation: observation.exactOptional(),
}) satisfies z.ZodType<UpdateAttendanceInput>;
