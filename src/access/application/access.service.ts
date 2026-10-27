import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import type { ProfileRepository } from "../../profiles/domain/profile.repository.js";
import type { App, AssignRoleInput, CreateCatalogInput, Role, UserRole } from "../domain/access.entity.js";
import type { AppRepository, RoleRepository, UserRoleRepository } from "../domain/access.repository.js";
import { assignRoleSchema, createCatalogSchema } from "./access.schemas.js";

export class AccessService {
  constructor(
    private readonly apps: AppRepository,
    private readonly roles: RoleRepository,
    private readonly userRoles: UserRoleRepository,
    private readonly profiles: ProfileRepository,
  ) {}

  listApps(): Promise<App[]> {
    return this.apps.findAll();
  }

  async createApp(data: CreateCatalogInput, actor: ActorId): Promise<App> {
    const input = parseInput(createCatalogSchema, data, "Aplicación");
    if (await this.apps.findByCode(input.code)) {
      throw new ConflictError(`La aplicación "${input.code}" ya existe`);
    }
    return this.apps.create(input, actor);
  }

  listRoles(): Promise<Role[]> {
    return this.roles.findAll();
  }

  async createRole(data: CreateCatalogInput, actor: ActorId): Promise<Role> {
    const input = parseInput(createCatalogSchema, data, "Rol");
    if (await this.roles.findByCode(input.code)) {
      throw new ConflictError(`El rol "${input.code}" ya existe`);
    }
    return this.roles.create(input, actor);
  }

  getUserRoles(userId: string, app?: string): Promise<UserRole[]> {
    return this.userRoles.findByUser(userId, app);
  }

  /** Un rol global (sin aplicación) aplica a cualquier aplicación. */
  async hasRole(userId: string, role: string, app?: string): Promise<boolean> {
    const roles = await this.userRoles.findByUser(userId, app);
    return roles.some((r) => r.role === role);
  }

  async assignRole(data: AssignRoleInput, actor: ActorId): Promise<UserRole> {
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

  async revokeRole(id: bigint, actor: ActorId): Promise<void> {
    if (!(await this.userRoles.findById(id))) {
      throw new NotFoundError("Asignación de rol", id);
    }
    await this.userRoles.delete(id, actor);
  }
}
