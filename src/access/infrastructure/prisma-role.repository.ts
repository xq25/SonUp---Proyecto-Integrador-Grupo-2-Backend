import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { CreateRoleInput, Role } from "../domain/role.entity.js";
import type { RoleRepository } from "../domain/role.repository.js";

const roleSelect = { code: true, name: true, ...auditSelect } satisfies Prisma.RoleSelect;

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByCode(code: string): Promise<Role | null> {
    return this.prisma.role.findFirst({ where: { code, ...notDeleted }, select: roleSelect });
  }

  findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({ where: notDeleted, select: roleSelect, orderBy: { name: "asc" } });
  }

  create(data: CreateRoleInput, actor: ActorId): Promise<Role> {
    return withPrismaErrors("Rol", () =>
      this.prisma.role.create({ data: { ...data, ...audit.create(actor) }, select: roleSelect }),
    );
  }
}
