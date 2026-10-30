import type { ActorId } from "../../shared/domain/auditable.js";
import type { Evidence, UpdateEvidenceInput, UploadEvidenceInput } from "./evidence.entity.js";

export interface EvidenceRepository {
  findById(id: bigint): Promise<Evidence | null>;
  /** Crea la evidencia y sus relaciones con estudiantes de forma atómica. */
  create(data: UploadEvidenceInput, actor: ActorId): Promise<Evidence>;
  update(id: bigint, data: UpdateEvidenceInput, actor: ActorId): Promise<Evidence>;
  /** Borrado lógico de la evidencia y de sus relaciones vigentes, de forma atómica. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
