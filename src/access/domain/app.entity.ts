import type { AuditableEntity } from "../../shared/domain/auditable.js";

/** Aplicación del ecosistema (tabla `aplicaciones`) sobre la que puede acotarse un rol. */
export interface App extends AuditableEntity {
  code: string;
  name: string;
}

export interface CreateAppInput {
  code: string;
  name: string;
}
