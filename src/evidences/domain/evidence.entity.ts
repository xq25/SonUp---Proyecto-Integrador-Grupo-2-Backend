import type { AuditableEntity } from "../../shared/domain/auditable.js";

/**
 * Evidencia (video, imagen o documento). Quién la subió y cuándo quedan en
 * `createdBy` / `createdAt` (diagrama: upload_by / upload_at): puede subirla
 * cualquier actor con permiso, incluidos los administrativos.
 */
export interface Evidence extends AuditableEntity {
  id: bigint;
  /** Enlace https (máx. 2048). */
  url: string;
  /** 2–150 caracteres. */
  title: string;
}

/** Estudiantes por evidencia: al menos 1 y como máximo 50 (§3.10). */
export const MIN_STUDENTS_PER_EVIDENCE = 1;
export const MAX_STUDENTS_PER_EVIDENCE = 50;

export interface UploadEvidenceInput {
  url: string;
  title: string;
  /** Estudiantes (`child_id`) relacionados con la evidencia: 1 a 50, activos. */
  studentIds: bigint[];
}

export interface UpdateEvidenceInput {
  url?: string;
  title?: string;
}

/** Relación estudiante–evidencia. */
export interface StudentEvidence extends AuditableEntity {
  id: bigint;
  studentId: bigint;
  evidenceId: bigint;
}

/** Relación con los datos de la evidencia. */
export interface StudentEvidenceWithEvidence extends StudentEvidence {
  evidence: Evidence;
}

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
