import type { AuditableEntity } from "../../shared/domain/auditable.js";

// Valores definidos por el check de `credentials.status` en la BD (§3.12).
export const CREDENTIAL_STATUSES = ["pending", "valid", "revoked"] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

/**
 * Certificado o credencial de un estudiante, opcionalmente asociada a un taller
 * `finished` al que el estudiante asistió.
 */
export interface Credential extends AuditableEntity {
  id: bigint;
  studentId: bigint;
  /** 2–150 caracteres. */
  organizationName: string;
  workshopId: bigint | null;
  /** Soporte del certificado: enlace https (máx. 2048). */
  url: string;
  status: CredentialStatus;
}

/** Toda credencial nace `pending`; luego cambia de estado con `update`. */
export interface RegisterCredentialInput {
  studentId: bigint;
  organizationName: string;
  workshopId?: bigint | null;
  url: string;
  status?: "pending";
}

export interface UpdateCredentialInput {
  organizationName?: string;
  workshopId?: bigint | null;
  url?: string;
  status?: CredentialStatus;
}
