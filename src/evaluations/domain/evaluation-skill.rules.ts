import { ConflictError } from "../../shared/domain/errors.js";
import type { Workshop } from "../../workshops/domain/workshop.entity.js";

// Reglas de evaluación según el estado del taller (docs/VALIDACIONES.md §3.9). Funciones puras.

/** Solo se evalúa (crear o cambiar una evaluación) mientras el taller está `active`. */
export function ensureCanEvaluate(workshop: Workshop): void {
  if (workshop.status !== "active") {
    throw new ConflictError(`Solo se evalúa en talleres "active"; este está "${workshop.status}"`);
  }
}

/** Con el taller cerrado (`finished`/`cancelled`) las evaluaciones son historial: no se eliminan. */
export function ensureEvaluationRemovable(workshop: Workshop): void {
  if (workshop.status === "finished" || workshop.status === "cancelled") {
    throw new ConflictError(`El taller está "${workshop.status}": sus evaluaciones no se pueden eliminar`);
  }
}
