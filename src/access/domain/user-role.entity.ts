import type { AuditableEntity } from "../../shared/domain/auditable.js";

/** Asignación de un rol a un perfil, global (`app = null`) o por aplicación. */
export interface UserRole extends AuditableEntity {
  id: bigint;
  userId: string;
  role: string;
  app: string | null;
  assignedBy: string | null;
}

export interface AssignRoleInput {
  userId: string;
  role: string;
  app?: string | null;
}
