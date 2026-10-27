import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { App, AssignRoleInput, CreateCatalogInput, Role, UserRole } from "../domain/access.entity.js";
import type { AppRepository, RoleRepository, UserRoleRepository } from "../domain/access.repository.js";

const catalogSelect = { code: true, name: true, ...auditSelect } as const;

export class PrismaAppRepository implements AppRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByCode(code: string): Promise<App | null> {
    return this.prisma.app.findFirst({ where: { code, ...notDeleted }, select: catalogSelect });
  }

  findAll(): Promise<App[]> {
    return this.prisma.app.findMany({ where: notDeleted, select: catalogSelect, orderBy: { name: "asc" } });
  }

  create(data: CreateCatalogInput, actor: ActorId): Promise<App> {
    return withPrismaErrors("Aplicación", () =>
      this.prisma.app.create({ data: { ...data, ...audit.create(actor) }, select: catalogSelect }),
    );
  }
}

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByCode(code: string): Promise<Role | null> {
    return this.prisma.role.findFirst({ where: { code, ...notDeleted }, select: catalogSelect });
  }

  findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({ where: notDeleted, select: catalogSelect, orderBy: { name: "asc" } });
  }

  create(data: CreateCatalogInput, actor: ActorId): Promise<Role> {
    return withPrismaErrors("Rol", () =>
      this.prisma.role.create({ data: { ...data, ...audit.create(actor) }, select: catalogSelect }),
    );
  }
}

const userRoleSelect = {
  id: true,
  userId: true,
  role: true,
  app: true,
  assignedBy: true,
  ...auditSelect,
} satisfies Prisma.UserRoleSelect;

type UserRoleRow = Prisma.UserRoleGetPayload<{ select: typeof userRoleSelect }>;

const toUserRole = (row: UserRoleRow): UserRole => ({ ...row });

const ENTITY = "Asignación de rol";

export class PrismaUserRoleRepository implements UserRoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<UserRole | null> {
    const row = await this.prisma.userRole.findFirst({ where: { id, ...notDeleted }, select: userRoleSelect });
    return row && toUserRole(row);
  }

  async find(userId: string, role: string, app: string | null): Promise<UserRole | null> {
    // findFirst: el unique compuesto incluye una columna nullable.
    const row = await this.prisma.userRole.findFirst({
      where: { userId, role, app, ...notDeleted },
      select: userRoleSelect,
    });
    return row && toUserRole(row);
  }

  async findByUser(userId: string, app?: string): Promise<UserRole[]> {
    const where: Prisma.UserRoleWhereInput = { userId, ...notDeleted };
    if (app !== undefined) where.OR = [{ app }, { app: null }];
    const rows = await this.prisma.userRole.findMany({ where, select: userRoleSelect });
    return rows.map(toUserRole);
  }

  create(data: AssignRoleInput, actor: ActorId): Promise<UserRole> {
    const app = data.app ?? null;
    return withPrismaErrors(ENTITY, async () => {
      // La BD tiene unique (usuario, rol, aplicacion): un rol revocado se restaura.
      const revoked = await this.prisma.userRole.findFirst({
        where: { userId: data.userId, role: data.role, app, deletedAt: { not: null } },
        select: { id: true },
      });
      const row = revoked
        ? await this.prisma.userRole.update({
            where: { id: revoked.id },
            data: { assignedBy: actor, ...audit.restore(actor) },
            select: userRoleSelect,
          })
        : await this.prisma.userRole.create({
            data: { userId: data.userId, role: data.role, app, assignedBy: actor, ...audit.create(actor) },
            select: userRoleSelect,
          });
      return toUserRole(row);
    });
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors(ENTITY, () =>
      this.prisma.userRole.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
