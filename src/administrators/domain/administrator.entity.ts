import type { AuditableEntity, QueryOptions } from "../../shared/domain/auditable.js";
import type { DocumentType } from "../../shared/domain/document-types.js";

// PROVISIONAL: el acceso de los administrativos no se había contemplado.
// La entidad es mínima y está aislada tras AdministratorRepository para poder
// cambiar su origen (p. ej. datos del módulo administrativo) sin tocar el resto.
// Validaciones aprobadas: docs/VALIDACIONES.md §3.1.

// Valores definidos por el check de `administrators.status` en la BD.
export const ADMINISTRATOR_STATUSES = ["active", "inactive"] as const;
export type AdministratorStatus = (typeof ADMINISTRATOR_STATUSES)[number];

export interface Administrator extends AuditableEntity {
  id: bigint;
  fullName: string;
  documentType: DocumentType;
  /** Único. */
  documentNumber: string;
  /** Único, en minúsculas. */
  email: string;
  phone: string | null;
  /** Cargo dentro de la fundación. */
  position: string;
  status: AdministratorStatus;
}

export interface CreateAdministratorInput {
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string;
  phone?: string | null;
  position: string;
  status?: AdministratorStatus;
}

export type UpdateAdministratorInput = Partial<CreateAdministratorInput>;

export interface AdministratorFilter extends QueryOptions {
  status?: AdministratorStatus;
  /** Busca en nombre completo, número de documento o email. */
  search?: string;
}
