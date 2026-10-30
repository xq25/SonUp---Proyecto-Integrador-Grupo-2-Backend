import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import type { ProfileRepository } from "../../profiles/domain/profile.repository.js";
import type { AppRepository } from "../domain/app.repository.js";
import type { RoleRepository } from "../domain/role.repository.js";
import type { AssignRoleInput, UserRole } from "../domain/user-role.entity.js";
import type { UserRoleRepository } from "../domain/user-role.repository.js";
import { assignRoleSchema } from "./user-role.schemas.js";

/** Roles asignados a cada perfil, globales o por aplicación. */
export class UserRolesService {
  constructor(
    private readonly userRoles: UserRoleRepository,
    private readonly roles: RoleRepository,
    private readonly apps: AppRepository,
    private readonly profiles: ProfileRepository,
  ) {}

  getUserRoles(userId: string, app?: string): Promise<UserRole[]> {
    return this.userRoles.findByUser(userId, app);
  }

  /** Un rol global (sin aplicación) aplica a cualquier aplicación. */
  async hasRole(userId: string, role: string, app?: string): Promise<boolean> {
    const roles = await this.userRoles.findByUser(userId, app);
    return roles.some((r) => r.role === role);
  }

  async assign(data: AssignRoleInput, actor: ActorId): Promise<UserRole> {
    const input = parseInput(assignRoleSchema, data, "Asignación de rol");
    const app = input.app ?? null;

    if (!(await this.profiles.findById(input.userId))) {
      throw new NotFoundError("Perfil", input.userId);
    }
    if (!(await this.roles.findByCode(input.role))) {
      throw new NotFoundError("Rol", input.role);
    }
    if (app !== null && !(await this.apps.findByCode(app))) {
      throw new NotFoundError("Aplicación", app);
    }
    if (await this.userRoles.find(input.userId, input.role, app)) {
      throw new ConflictError("El usuario ya tiene ese rol con ese alcance");
    }

    return this.userRoles.create({ ...input, app }, actor);
  }

  async revoke(id: bigint, actor: ActorId): Promise<void> {
    if (!(await this.userRoles.findById(id))) {
      throw new NotFoundError("Asignación de rol", id);
    }
    await this.userRoles.delete(id, actor);
  }
}
