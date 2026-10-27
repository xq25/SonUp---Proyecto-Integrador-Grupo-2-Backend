import type { ActorId } from "../../shared/domain/auditable.js";
import type { App, AssignRoleInput, CreateCatalogInput, Role, UserRole } from "./access.entity.js";

export interface AppRepository {
  findByCode(code: string): Promise<App | null>;
  findAll(): Promise<App[]>;
  create(data: CreateCatalogInput, actor: ActorId): Promise<App>;
}

export interface RoleRepository {
  findByCode(code: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  create(data: CreateCatalogInput, actor: ActorId): Promise<Role>;
}

export interface UserRoleRepository {
  findById(id: bigint): Promise<UserRole | null>;
  /** Asignación vigente exacta (mismo usuario, rol y alcance). */
  find(userId: string, role: string, app: string | null): Promise<UserRole | null>;
  /**
   * Roles vigentes de un usuario. Con `app` devuelve los de esa aplicación
   * más los globales (`app = null`).
   */
  findByUser(userId: string, app?: string): Promise<UserRole[]>;
  /** Crea la asignación o, si existía revocada, la restaura. `actor` queda como assignedBy. */
  create(data: AssignRoleInput, actor: ActorId): Promise<UserRole>;
  /** Borrado lógico (revocar). */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
