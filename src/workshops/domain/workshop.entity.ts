import type { AuditableEntity, QueryOptions } from "../../shared/domain/auditable.js";

// Valores definidos por el check de `workshops.status` en la BD (provisionales).
export const WORKSHOP_STATUSES = ["planned", "active", "finished", "cancelled"] as const;
export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];

/** Taller. `evaluatorId` es el `professional_id` (tallerista) del módulo administrativo. */
export interface Workshop extends AuditableEntity {
  id: bigint;
  evaluatorId: bigint;
  name: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: WorkshopStatus;
}

/** Un taller siempre nace `planned`; luego cambia de estado con `update`. */
export interface CreateWorkshopInput {
  evaluatorId: bigint;
  name: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  status?: "planned";
}

export interface UpdateWorkshopInput {
  evaluatorId?: bigint;
  name?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  status?: WorkshopStatus;
}

export interface WorkshopFilter extends QueryOptions {
  evaluatorId?: bigint;
  status?: WorkshopStatus;
  /** Busca en el nombre. */
  search?: string;
}

/** Habilidad que se trabaja en un taller. */
export interface WorkshopSkill extends AuditableEntity {
  id: bigint;
  workshopId: bigint;
  skillId: bigint;
}

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
