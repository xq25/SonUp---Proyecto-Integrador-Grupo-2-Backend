import { ConflictError, ValidationError } from "../../shared/domain/errors.js";
import type { Workshop } from "./workshop.entity.js";
import type { UpdateWorkshopSessionInput, WorkshopSession } from "./workshop-session.entity.js";

// Reglas de las sesiones de un taller (docs/VALIDACIONES.md §3.13, ADR-009). Funciones puras.
// El fin de una sesión no se programa: se guarda al finalizarla. Por eso una sesión
// programada o en curso es solo un inicio, y solo las finalizadas tienen intervalo [inicio, fin).

const formatTime = (date: Date) =>
  date.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });

const describe = (session: WorkshopSession) =>
  session.endsAt
    ? `«${session.topic}» (${formatTime(session.startsAt)} – ${formatTime(session.endsAt)})`
    : `«${session.topic}» (${formatTime(session.startsAt)})`;

/** ¿El momento cae dentro del horario real de una sesión finalizada? [inicio, fin) */
const isInside = (moment: Date, session: WorkshopSession) =>
  session.endsAt !== null && session.startsAt <= moment && moment < session.endsAt;

/** Las sesiones se crean, editan o eliminan con el taller `planned` o `active`. */
export function ensureWorkshopAcceptsSessions(workshop: Workshop): void {
  if (workshop.status !== "planned" && workshop.status !== "active") {
    throw new ConflictError(`El taller está "${workshop.status}": sus sesiones ya no se pueden cambiar`);
  }
}

/** El inicio cae dentro de las fechas del taller (si están definidas). */
export function ensureStartWithinWorkshop(workshop: Workshop, startsAt: Date): void {
  if (workshop.startsAt && startsAt < workshop.startsAt) {
    throw new ValidationError("La sesión empieza antes del inicio del taller");
  }
  if (workshop.endsAt && startsAt >= workshop.endsAt) {
    throw new ValidationError("La sesión empieza después del fin del taller");
  }
}

/**
 * Al programar o mover una sesión: no repite la hora de inicio de otra sesión del
 * taller ni cae dentro del horario real de una sesión ya finalizada.
 */
export function ensureStartAvailable(sessions: readonly WorkshopSession[], startsAt: Date, excludeId?: bigint): void {
  for (const other of sessions) {
    if (other.id === excludeId) continue;
    if (other.startsAt.getTime() === startsAt.getTime()) {
      throw new ConflictError(`Ya hay una sesión que empieza a esa hora: ${describe(other)}`);
    }
    if (isInside(startsAt, other)) {
      throw new ConflictError(`La sesión empezaría durante la sesión ${describe(other)}`);
    }
  }
}

/**
 * Qué se puede cambiar según el estado:
 * - `planned`: todo (el inicio es tentativo).
 * - `in_progress`: solo el contenido (tema, objetivo, materiales, pasos).
 * - `finished`: nada (es historial).
 */
export function ensureSessionEditable(session: WorkshopSession, data: UpdateWorkshopSessionInput): void {
  if (session.status === "planned") return;
  if (session.status === "finished") {
    throw new ConflictError("La sesión ya finalizó: no se puede editar");
  }
  if (data.startsAt !== undefined && data.startsAt.getTime() !== session.startsAt.getTime()) {
    throw new ConflictError(
      "La sesión está en curso: solo se corrige su contenido (tema, objetivo, materiales, pasos), no su hora de inicio",
    );
  }
}

/**
 * Iniciar (`planned → in_progress`) abre la asistencia y la evaluación:
 * taller `active`, hora de inicio ya alcanzada, ninguna otra sesión en curso, el
 * inicio no cae dentro de una sesión ya dictada (p. ej. una anterior que terminó
 * más tarde de lo previsto) y no hay sesiones posteriores ya dictadas.
 */
export function ensureCanStartSession(
  workshop: Workshop,
  session: WorkshopSession,
  sessions: readonly WorkshopSession[],
  now: Date = new Date(),
): void {
  if (session.status !== "planned") {
    throw new ConflictError(`Solo se inicia una sesión "planned"; esta está "${session.status}"`);
  }
  if (workshop.status !== "active") {
    throw new ConflictError(`Las sesiones se inician con el taller "active"; este está "${workshop.status}"`);
  }
  if (session.startsAt > now) {
    throw new ConflictError(
      `La sesión empieza el ${formatTime(session.startsAt)}: todavía no se puede iniciar (si empieza antes, cambia primero su fecha de inicio)`,
    );
  }
  const inProgress = sessions.find((s) => s.id !== session.id && s.status === "in_progress");
  if (inProgress) {
    throw new ConflictError(`Ya hay una sesión en curso en este taller: ${describe(inProgress)}. Finalízala primero`);
  }
  const overlapped = sessions.find((s) => s.id !== session.id && isInside(session.startsAt, s));
  if (overlapped) {
    throw new ConflictError(
      `La sesión se cruza con la sesión ${describe(overlapped)}: cambia primero la fecha de inicio de esta sesión antes de tomar asistencia y calificar`,
    );
  }
  const later = sessions.find((s) => s.id !== session.id && s.status !== "planned" && s.startsAt > session.startsAt);
  if (later) {
    throw new ConflictError(
      `Ya se dictó una sesión posterior, ${describe(later)}: cambia primero la fecha de inicio de esta sesión o elimínala`,
    );
  }
}

/**
 * Finalizar (`in_progress → finished`) guarda el fin real: posterior al inicio,
 * no futuro y no posterior al fin del taller. Puede quedar encima del inicio de
 * una sesión `planned`: esa deberá corregir su inicio antes de iniciarse.
 */
export function ensureCanFinishSession(
  workshop: Workshop,
  session: WorkshopSession,
  endsAt: Date,
  now: Date = new Date(),
): void {
  if (session.status !== "in_progress") {
    throw new ConflictError(`Solo se finaliza una sesión "in_progress"; esta está "${session.status}"`);
  }
  if (endsAt <= session.startsAt) throw new ValidationError("El fin de la sesión debe ser posterior a su inicio");
  if (endsAt > now) throw new ValidationError("El fin real de la sesión no puede ser futuro");
  if (workshop.endsAt && endsAt > workshop.endsAt) {
    throw new ValidationError("La sesión termina después del fin del taller");
  }
}

/** Solo se elimina una sesión `planned` (aún no tiene asistencias ni evaluaciones). */
export function ensureSessionDeletable(session: WorkshopSession): void {
  if (session.status !== "planned") {
    throw new ConflictError(`Solo se elimina una sesión "planned"; esta está "${session.status}"`);
  }
}
