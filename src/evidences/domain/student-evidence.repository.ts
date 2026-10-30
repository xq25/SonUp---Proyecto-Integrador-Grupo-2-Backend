import type { ActorId } from "../../shared/domain/auditable.js";
import type { StudentEvidence, StudentEvidenceWithEvidence } from "./student-evidence.entity.js";

export interface StudentEvidenceRepository {
  /** Relación vigente (no eliminada). */
  find(studentId: bigint, evidenceId: bigint): Promise<StudentEvidence | null>;
  findByStudent(studentId: bigint): Promise<StudentEvidenceWithEvidence[]>;
  findByEvidence(evidenceId: bigint): Promise<StudentEvidence[]>;
  /** Crea la relación o restaura una eliminada (única por estudiante y evidencia). */
  create(studentId: bigint, evidenceId: bigint, actor: ActorId): Promise<StudentEvidence>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
