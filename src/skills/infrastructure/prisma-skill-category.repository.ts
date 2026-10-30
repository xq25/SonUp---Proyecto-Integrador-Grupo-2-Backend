import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  CreateSkillCategoryInput,
  SkillCategory,
  UpdateSkillCategoryInput,
} from "../domain/skill-category.entity.js";
import type { SkillCategoryRepository } from "../domain/skill-category.repository.js";

const categorySelect = { id: true, name: true, description: true, ...auditSelect } satisfies Prisma.SkillCategorySelect;

export class PrismaSkillCategoryRepository implements SkillCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<SkillCategory | null> {
    return this.prisma.skillCategory.findFirst({ where: { id, ...notDeleted }, select: categorySelect });
  }

  findByName(name: string): Promise<SkillCategory | null> {
    // Igual que el índice único de la BD: lower(name).
    return this.prisma.skillCategory.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: categorySelect,
    });
  }

  findAll(): Promise<SkillCategory[]> {
    return this.prisma.skillCategory.findMany({ where: notDeleted, select: categorySelect, orderBy: { name: "asc" } });
  }

  create(data: CreateSkillCategoryInput, actor: ActorId): Promise<SkillCategory> {
    return withPrismaErrors("Categoría de habilidad", () =>
      this.prisma.skillCategory.create({ data: { ...data, ...audit.create(actor) }, select: categorySelect }),
    );
  }

  update(id: bigint, data: UpdateSkillCategoryInput, actor: ActorId): Promise<SkillCategory> {
    return withPrismaErrors("Categoría de habilidad", () =>
      this.prisma.skillCategory.update({ where: { id }, data: { ...data, ...audit.update(actor) }, select: categorySelect }),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Categoría de habilidad", () =>
      this.prisma.skillCategory.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
