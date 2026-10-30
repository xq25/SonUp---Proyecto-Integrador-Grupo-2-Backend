import type { AuditableEntity } from "../../shared/domain/auditable.js";
import type { Evidence } from "./evidence.entity.js";

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
