import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError } from "../../shared/domain/errors.js";
import type { CreateRoleInput, Role } from "../domain/role.entity.js";
import type { RoleRepository } from "../domain/role.repository.js";
import { createRoleSchema } from "./role.schemas.js";

/** Catálogo de roles. */
export class RolesService {
  constructor(private readonly roles: RoleRepository) {}

  list(): Promise<Role[]> {
    return this.roles.findAll();
  }

  async create(data: CreateRoleInput, actor: ActorId): Promise<Role> {
    const input = parseInput(createRoleSchema, data, "Rol");
    if (await this.roles.findByCode(input.code)) {
      throw new ConflictError(`El rol "${input.code}" ya existe`);
    }
    return this.roles.create(input, actor);
  }
}
