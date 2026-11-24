import type { AuditableEntity } from "../../shared/domain/auditable.js";

/**
 * Asistencia de un estudiante (`child_id` del módulo administrativo) a una
 * sesión de un taller (ADR-009). `workshopId` es el taller de la sesión y
 * `attendedAt`, el inicio de la sesión.
 */
export interface WorkshopAttendance extends AuditableEntity {
  id: bigint;
  studentId: bigint;
  workshopId: bigint;
  sessionId: bigint;
  attendedAt: Date;
  observation: string | null;
}

/** Entrada: la sesión define el taller y la fecha. */
export interface RegisterAttendanceInput {
  sessionId: bigint;
  studentId: bigint;
  observation?: string | null;
}

/** Lo que guarda el repositorio al registrar: completado por el servicio desde la sesión. */
export interface NewAttendance extends RegisterAttendanceInput {
  workshopId: bigint;
  attendedAt: Date;
}

/** Solo se corrige la observación: para cambiar de sesión se elimina y se registra en la otra. */
export interface UpdateAttendanceInput {
  observation?: string | null;
}
