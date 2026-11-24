import { ConflictError } from "../../shared/domain/errors.js";
import type { Workshop } from "./workshop.entity.js";
import type { WorkshopSession } from "./workshop-session.entity.js";

// Reglas de asistencia a las sesiones de un taller (docs/VALIDACIONES.md §3.8 y §3.13). Funciones puras.

/**
 * Solo se registra o elimina una asistencia con la sesión en curso y el taller
 * `active`. Con la sesión finalizada, la asistencia es historial (solo se
 * corrige la observación).
 */
export function ensureCanTakeAttendance(workshop: Workshop, session: WorkshopSession): void {
  if (session.status !== "in_progress") {
    throw new ConflictError(
      session.status === "planned"
        ? "La sesión aún no ha iniciado: iníciala para tomar asistencia"
        : "La sesión ya finalizó: sus asistencias son historial (solo se corrige la observación)",
    );
  }
  if (workshop.status !== "active") {
    throw new ConflictError(`Solo se toma asistencia en talleres "active"; este está "${workshop.status}"`);
  }
}
