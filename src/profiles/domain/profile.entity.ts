import type { AuditableEntity, QueryOptions } from "../../shared/domain/auditable.js";

// Valores definidos por el check de `perfiles.estado` en la BD.
export const PROFILE_STATUSES = ["activo", "inactivo", "bloqueado"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/**
 * Perfil de un usuario. `id` es el mismo UUID de `auth.users` (Supabase).
 * Los perfiles los crea el trigger `crear_perfil` al registrarse en Supabase
 * Auth; este módulo solo los consulta, actualiza y elimina (borrado lógico).
 */
export interface Profile extends AuditableEntity {
  id: string;
  firstNames: string;
  lastNames: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  status: ProfileStatus;
  dataProcessingAcceptedAt: Date | null;
}

export type UpdateProfileInput = Partial<
  Pick<
    Profile,
    "firstNames" | "lastNames" | "phone" | "documentType" | "documentNumber" | "status" | "dataProcessingAcceptedAt"
  >
>;

export interface ProfileFilter extends QueryOptions {
  status?: ProfileStatus;
  /** Busca en nombres, apellidos o número de documento. */
  search?: string;
}
