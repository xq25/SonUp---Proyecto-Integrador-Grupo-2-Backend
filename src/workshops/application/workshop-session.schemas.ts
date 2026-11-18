import { z } from "zod";
import { dateTimeSchema, nameSchema, optionalTextSchema } from "../../shared/application/schemas.js";
import type {
  CreateWorkshopSessionInput,
  FinishWorkshopSessionInput,
  UpdateWorkshopSessionInput,
} from "../domain/workshop-session.entity.js";

// Esquemas de entrada de sesiones de taller (nivel 1, ADR-001).
// Solo validan la FORMA (docs/VALIDACIONES.md §3.13); las reglas de negocio
// (estados, cruces, fechas del taller…) siguen en el servicio y en `workshop-session.rules.ts`.
// El fin no se recibe al crear ni al editar: se da al finalizar la sesión.

const topic = nameSchema(2, 150);
const objective = optionalTextSchema(1000);
const materials = optionalTextSchema(1000);
const steps = optionalTextSchema(2000);

/** Toda sesión nace `planned`: el estado no se recibe. */
export const createWorkshopSessionSchema = z.strictObject({
  startsAt: dateTimeSchema,
  topic,
  objective: objective.exactOptional(),
  materials: materials.exactOptional(),
  steps: steps.exactOptional(),
}) satisfies z.ZodType<CreateWorkshopSessionInput>;

/** El estado cambia con iniciar y finalizar, no al editar. */
export const updateWorkshopSessionSchema = z.strictObject({
  startsAt: dateTimeSchema.exactOptional(),
  topic: topic.exactOptional(),
  objective: objective.exactOptional(),
  materials: materials.exactOptional(),
  steps: steps.exactOptional(),
}) satisfies z.ZodType<UpdateWorkshopSessionInput>;

/** Fin real de la sesión; si no se envía, es ahora. */
export const finishWorkshopSessionSchema = z.strictObject({
  endsAt: dateTimeSchema.exactOptional(),
}) satisfies z.ZodType<FinishWorkshopSessionInput>;
