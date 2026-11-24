import { ConflictError } from "../../shared/domain/errors.js";
import type { Workshop } from "../../workshops/domain/workshop.entity.js";
import type { WorkshopSession } from "../../workshops/domain/workshop-session.entity.js";

// Reglas de evaluación según la sesión y el taller (docs/VALIDACIONES.md §3.9 y §3.13). Funciones puras.

/**
 * Solo se evalúa (crear, cambiar o eliminar una evaluación) con la sesión de la
 * asistencia en curso y el taller `active`. Con la sesión `finished`, las
 * evaluaciones son historial y ya cuentan en las calificaciones.
 */
export function ensureCanEvaluate(workshop: Workshop, session: WorkshopSession): void {
  if (session.status !== "in_progress") {
    throw new ConflictError(
      session.status === "planned"
        ? 'La sesión aún no ha iniciado: iníciala para evaluar'
        : "La sesión ya finalizó: sus evaluaciones son historial y no se cambian",
    );
  }
  if (workshop.status !== "active") {
    throw new ConflictError(`Solo se evalúa en talleres "active"; este está "${workshop.status}"`);
  }
}
