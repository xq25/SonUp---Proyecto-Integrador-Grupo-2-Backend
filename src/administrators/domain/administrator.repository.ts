import type { ActorId, QueryOptions } from "../../shared/domain/auditable.js";
import type {
  Administrator,
  AdministratorFilter,
  CreateAdministratorInput,
  UpdateAdministratorInput,
} from "./administrator.entity.js";

export interface AdministratorRepository {
  findById(id: bigint, options?: QueryOptions): Promise<Administrator | null>;
  /** Incluye eliminados: el documento es único en toda la tabla. */
  findByDocumentNumber(documentNumber: string): Promise<Administrator | null>;
  /** Incluye eliminados: el email es único en toda la tabla. Recibe el email en minúsculas. */
  findByEmail(email: string): Promise<Administrator | null>;
  findMany(filter?: AdministratorFilter): Promise<Administrator[]>;
  create(data: CreateAdministratorInput, actor: ActorId): Promise<Administrator>;
  update(id: bigint, data: UpdateAdministratorInput, actor: ActorId): Promise<Administrator>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
  restore(id: bigint, actor: ActorId): Promise<Administrator>;
}
