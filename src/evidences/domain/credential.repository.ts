import type { ActorId } from "../../shared/domain/auditable.js";
import type { Credential, RegisterCredentialInput, UpdateCredentialInput } from "./credential.entity.js";

export interface CredentialRepository {
  findById(id: bigint): Promise<Credential | null>;
  findByStudent(studentId: bigint): Promise<Credential[]>;
  create(data: RegisterCredentialInput, actor: ActorId): Promise<Credential>;
  update(id: bigint, data: UpdateCredentialInput, actor: ActorId): Promise<Credential>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
