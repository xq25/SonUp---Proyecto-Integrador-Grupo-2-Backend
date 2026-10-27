import type { ActorId, QueryOptions } from "../../shared/domain/auditable.js";
import type { Profile, ProfileFilter, UpdateProfileInput } from "./profile.entity.js";

/** Puerto de persistencia de perfiles. La infraestructura lo implementa. */
export interface ProfileRepository {
  findById(id: string, options?: QueryOptions): Promise<Profile | null>;
  /** Incluye eliminados: el documento es único en toda la tabla. */
  findByDocumentNumber(documentNumber: string): Promise<Profile | null>;
  findMany(filter?: ProfileFilter): Promise<Profile[]>;
  update(id: string, data: UpdateProfileInput, actor: ActorId): Promise<Profile>;
  /** Borrado lógico. */
  delete(id: string, actor: ActorId): Promise<void>;
  restore(id: string, actor: ActorId): Promise<Profile>;
}
