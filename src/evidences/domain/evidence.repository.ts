import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  Credential,
  Evidence,
  RegisterCredentialInput,
  StudentEvidence,
  StudentEvidenceWithEvidence,
  UpdateCredentialInput,
  UpdateEvidenceInput,
  UploadEvidenceInput,
} from "./evidence.entity.js";

export interface EvidenceRepository {
  findById(id: bigint): Promise<Evidence | null>;
  /** Crea la evidencia y sus relaciones con estudiantes de forma atómica. */
  create(data: UploadEvidenceInput, actor: ActorId): Promise<Evidence>;
  update(id: bigint, data: UpdateEvidenceInput, actor: ActorId): Promise<Evidence>;
  /** Borrado lógico de la evidencia y de sus relaciones vigentes, de forma atómica. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}

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

export interface CredentialRepository {
  findById(id: bigint): Promise<Credential | null>;
  findByStudent(studentId: bigint): Promise<Credential[]>;
  create(data: RegisterCredentialInput, actor: ActorId): Promise<Credential>;
  update(id: bigint, data: UpdateCredentialInput, actor: ActorId): Promise<Credential>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
