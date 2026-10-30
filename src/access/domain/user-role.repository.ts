import type { ActorId } from "../../shared/domain/auditable.js";
import type { AssignRoleInput, UserRole } from "./user-role.entity.js";

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
