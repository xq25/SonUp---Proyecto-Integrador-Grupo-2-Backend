import type { AuditableEntity } from "../../shared/domain/auditable.js";

/** Aplicación del ecosistema (tabla `aplicaciones`) sobre la que puede acotarse un rol. */
export interface App extends AuditableEntity {
  code: string;
  name: string;
}

export interface Role extends AuditableEntity {
  code: string;
  name: string;
}

export interface CreateCatalogInput {
  code: string;
  name: string;
}

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
