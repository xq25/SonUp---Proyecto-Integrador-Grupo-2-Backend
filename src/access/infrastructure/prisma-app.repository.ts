import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { App, CreateAppInput } from "../domain/app.entity.js";
import type { AppRepository } from "../domain/app.repository.js";

const appSelect = { code: true, name: true, ...auditSelect } satisfies Prisma.AppSelect;

export class PrismaAppRepository implements AppRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByCode(code: string): Promise<App | null> {
    return this.prisma.app.findFirst({ where: { code, ...notDeleted }, select: appSelect });
  }

  findAll(): Promise<App[]> {
    return this.prisma.app.findMany({ where: notDeleted, select: appSelect, orderBy: { name: "asc" } });
  }

  create(data: CreateAppInput, actor: ActorId): Promise<App> {
    return withPrismaErrors("Aplicación", () =>
      this.prisma.app.create({ data: { ...data, ...audit.create(actor) }, select: appSelect }),
    );
  }
}
