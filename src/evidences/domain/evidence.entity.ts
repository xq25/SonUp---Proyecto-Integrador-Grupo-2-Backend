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
