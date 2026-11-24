import type { AuditableEntity } from "../../shared/domain/auditable.js";

// Valores definidos por el check de `workshop_sessions.status` en la BD (ADR-009).
export const WORKSHOP_SESSION_STATUSES = ["planned", "in_progress", "finished"] as const;
export type WorkshopSessionStatus = (typeof WORKSHOP_SESSION_STATUSES)[number];

/**
 * Sesión de un taller: una clase o encuentro con su horario y su contenido.
 * - `planned`: programada; su inicio es tentativo y se edita.
 * - `in_progress`: en curso; se toma asistencia y se evalúa.
 * - `finished`: finalizada; `endsAt` es el fin real y sus evaluaciones cuentan en las calificaciones.
 * El fin no se programa: solo lo tienen las sesiones finalizadas.
 */
export interface WorkshopSession extends AuditableEntity {
  id: bigint;
  workshopId: bigint;
  startsAt: Date;
  /** Fin real: `null` hasta finalizar la sesión. */
  endsAt: Date | null;
  /** Tema de la sesión. */
  topic: string;
  /** Objetivo de la sesión. */
  objective: string | null;
  /** Materiales o implementos que deben llevar los jóvenes. */
  materials: string | null;
  /** Pasos o actividades de la sesión. */
  steps: string | null;
  status: WorkshopSessionStatus;
}

/** Toda sesión nace `planned`, sin fin; el taller viene de la ruta. */
export interface CreateWorkshopSessionInput {
  startsAt: Date;
  topic: string;
  objective?: string | null;
  materials?: string | null;
  steps?: string | null;
}

/** El inicio solo cambia en `planned`; el contenido también en `in_progress`. El fin se da al finalizar. */
export interface UpdateWorkshopSessionInput {
  startsAt?: Date;
  topic?: string;
  objective?: string | null;
  materials?: string | null;
  steps?: string | null;
}

/** Al finalizar: fin real de la sesión (por defecto, ahora). */
export interface FinishWorkshopSessionInput {
  endsAt?: Date;
}

/** Lo que el repositorio guarda al actualizar: datos, estado y fin real. */
export interface WorkshopSessionChanges extends UpdateWorkshopSessionInput {
  status?: WorkshopSessionStatus;
  endsAt?: Date;
}
