import { ConflictError, ValidationError } from "../../shared/domain/errors.js";
import type { UpdateAttendanceInput, Workshop, WorkshopAttendance } from "./workshop.entity.js";

// Reglas de asistencia a talleres (docs/VALIDACIONES.md §3.8). Funciones puras.

/** Solo se registra asistencia en talleres que se están dictando. */
export function ensureCanRegisterAttendance(workshop: Workshop): void {
  if (workshop.status !== "active") {
    throw new ConflictError(`Solo se registra asistencia en talleres "active"; este está "${workshop.status}"`);
  }
}

/** La fecha no puede ser futura ni estar fuera de las fechas del taller. */
export function ensureValidAttendanceDate(workshop: Workshop, attendedAt: Date, now: Date = new Date()): void {
  if (attendedAt > now) {
    throw new ValidationError("La fecha de asistencia no puede ser futura");
  }
  if (workshop.startsAt && attendedAt < workshop.startsAt) {
    throw new ValidationError("La fecha de asistencia es anterior al inicio del taller");
  }
  if (workshop.endsAt && attendedAt > workshop.endsAt) {
    throw new ValidationError("La fecha de asistencia es posterior al fin del taller");
  }
}

/** ¿El taller está cerrado (`finished` o `cancelled`)? */
const isClosed = (workshop: Workshop) => workshop.status === "finished" || workshop.status === "cancelled";

/**
 * Con el taller cerrado, las asistencias son historial: solo se corrige la
 * observación. No se cambia la fecha ni se elimina la asistencia.
 */
export function ensureAttendanceEditable(workshop: Workshop, current: WorkshopAttendance, data: UpdateAttendanceInput): void {
  if (!isClosed(workshop)) return;
  if (data.attendedAt !== undefined && data.attendedAt.getTime() !== current.attendedAt.getTime()) {
    throw new ConflictError(`El taller está "${workshop.status}": solo se puede corregir la observación`);
  }
}

export function ensureAttendanceDeletable(workshop: Workshop): void {
  if (isClosed(workshop)) {
    throw new ConflictError(`El taller está "${workshop.status}": sus asistencias no se pueden eliminar`);
  }
}
