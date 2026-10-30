import type { AuditableEntity } from "../../shared/domain/auditable.js";

/** Rol del catálogo (tabla `roles`). */
export interface Role extends AuditableEntity {
  code: string;
  name: string;
}

export interface CreateRoleInput {
  code: string;
  name: string;
}
