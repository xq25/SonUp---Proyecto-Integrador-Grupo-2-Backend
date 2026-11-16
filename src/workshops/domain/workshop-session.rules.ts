import { ConflictError, ValidationError } from "../../shared/domain/errors.js";
import type { Workshop } from "./workshop.entity.js";
import type { UpdateWorkshopSessionInput, WorkshopSession } from "./workshop-session.entity.js";

// Reglas de las sesiones de un taller (docs/VALIDACIONES.md §3.13, ADR-009). Funciones puras.

/** Intervalo de una sesión: [inicio, fin). */
export interface SessionWindow {
  startsAt: Date;
  endsAt: Date;
}

/** ¿Se cruzan? Terminar a las 3:00 y empezar a las 3:00 no es cruce. */
export function sessionsOverlap(a: SessionWindow, b: SessionWindow): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** Primera sesión de la lista (sin contar `excludeId`) que se cruza con el intervalo. */
export function findOverlappingSession(
  sessions: readonly WorkshopSession[],
  window: SessionWindow,
  excludeId?: bigint,
): WorkshopSession | null {
  return sessions.find((s) => s.id !== excludeId && sessionsOverlap(s, window)) ?? null;
}

const formatTime = (date: Date) =>
  date.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });

const describe = (session: WorkshopSession) =>
  `«${session.topic}» (${formatTime(session.startsAt)} – ${formatTime(session.endsAt)})`;

/** Las sesiones se crean, editan o eliminan con el taller `planned` o `active`. */
export function ensureWorkshopAcceptsSessions(workshop: Workshop): void {
  if (workshop.status !== "planned" && workshop.status !== "active") {
    throw new ConflictError(`El taller está "${workshop.status}": sus sesiones ya no se pueden cambiar`);
  }
}

/** Fin posterior al inicio y dentro de las fechas del taller (si están definidas). */
export function ensureValidSessionWindow(workshop: Workshop, window: SessionWindow): void {
  if (window.endsAt <= window.startsAt) {
    throw new ValidationError("El fin de la sesión debe ser posterior a su inicio");
  }
  if (workshop.startsAt && window.startsAt < workshop.startsAt) {
    throw new ValidationError("La sesión empieza antes del inicio del taller");
  }
  if (workshop.endsAt && window.endsAt > workshop.endsAt) {
    throw new ValidationError("La sesión termina después del fin del taller");
  }
}

/** Al crear o editar el horario: no se cruza con ninguna otra sesión del taller. */
export function ensureNoOverlap(sessions: readonly WorkshopSession[], window: SessionWindow, excludeId?: bigint): void {
  const other = findOverlappingSession(sessions, window, excludeId);
  if (other) throw new ConflictError(`La sesión se cruza con la sesión ${describe(other)}`);
}

/**
 * Qué se puede cambiar según el estado:
 * - `planned`: todo (el horario es tentativo).
 * - `in_progress`: solo el contenido (tema, objetivo, materiales, pasos).
 * - `finished`: nada (es historial).
 */
export function ensureSessionEditable(session: WorkshopSession, data: UpdateWorkshopSessionInput): void {
  if (session.status === "planned") return;
  if (session.status === "finished") {
    throw new ConflictError("La sesión ya finalizó: no se puede editar");
  }
  const scheduleChanged = (["startsAt", "endsAt"] as const).filter(
    (field) => data[field] !== undefined && data[field].getTime() !== session[field].getTime(),
  );
  if (scheduleChanged.length > 0) {
    throw new ConflictError(
      `La sesión está en curso: solo se corrige su contenido (tema, objetivo, materiales, pasos), no su horario (campos: ${scheduleChanged.join(", ")})`,
    );
  }
}

/**
 * Iniciar (`planned → in_progress`) abre la asistencia y la evaluación:
 * taller `active`, hora de inicio ya alcanzada, ninguna otra sesión en curso y
 * sin cruzarse con otra sesión (p. ej. una anterior que terminó más tarde de lo previsto).
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
  const other = findOverlappingSession(sessions, session, session.id);
  if (other) {
    throw new ConflictError(
      `La sesión se cruza con la sesión ${describe(other)}: cambia primero la fecha de inicio de esta sesión antes de tomar asistencia y calificar`,
    );
  }
}

/**
 * Finalizar (`in_progress → finished`) con el fin real: posterior al inicio, no
 * futuro, dentro del taller y sin pisar otra sesión ya iniciada o finalizada.
 * Sí puede quedar encima de una sesión `planned`: esa deberá corregir su inicio.
 */
export function ensureCanFinishSession(
  workshop: Workshop,
  session: WorkshopSession,
  endsAt: Date,
  sessions: readonly WorkshopSession[],
  now: Date = new Date(),
): void {
  if (session.status !== "in_progress") {
    throw new ConflictError(`Solo se finaliza una sesión "in_progress"; esta está "${session.status}"`);
  }
  if (endsAt > now) throw new ValidationError("El fin real de la sesión no puede ser futuro");
  ensureValidSessionWindow(workshop, { startsAt: session.startsAt, endsAt });
  const started = sessions.filter((s) => s.status !== "planned");
  const other = findOverlappingSession(started, { startsAt: session.startsAt, endsAt }, session.id);
  if (other) throw new ConflictError(`El fin indicado se cruza con la sesión ${describe(other)}`);
}

/** Solo se elimina una sesión `planned` (aún no tiene asistencias ni evaluaciones). */
export function ensureSessionDeletable(session: WorkshopSession): void {
  if (session.status !== "planned") {
    throw new ConflictError(`Solo se elimina una sesión "planned"; esta está "${session.status}"`);
  }
}
