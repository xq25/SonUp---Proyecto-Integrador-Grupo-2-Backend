import type { ActorId } from "../../shared/domain/auditable.js";
import type { CreateRoleInput, Role } from "./role.entity.js";

export interface RoleRepository {
  findByCode(code: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  create(data: CreateRoleInput, actor: ActorId): Promise<Role>;
}
