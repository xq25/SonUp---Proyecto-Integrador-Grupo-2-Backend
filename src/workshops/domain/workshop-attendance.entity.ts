import type { AuditableEntity } from "../../shared/domain/auditable.js";

/** Asistencia de un estudiante (`child_id` del módulo administrativo) a un taller. */
export interface WorkshopAttendance extends AuditableEntity {
  id: bigint;
  studentId: bigint;
  workshopId: bigint;
  attendedAt: Date;
  observation: string | null;
}

export interface RegisterAttendanceInput {
  studentId: bigint;
  workshopId: bigint;
  /** Por defecto, ahora (now() en la BD). */
  attendedAt?: Date;
  observation?: string | null;
}

export interface UpdateAttendanceInput {
  attendedAt?: Date;
  observation?: string | null;
}
