import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { CreateSkillInput, Skill, SkillFilter, SkillStatus, UpdateSkillInput } from "../domain/skill.entity.js";
import type { SkillRepository } from "../domain/skill.repository.js";

const skillSelect = { id: true, name: true, skillCategoryId: true, status: true, ...auditSelect } satisfies Prisma.SkillSelect;

type SkillRow = Prisma.SkillGetPayload<{ select: typeof skillSelect }>;

// `status` está restringido por un check en la BD.
const toSkill = (row: SkillRow): Skill => ({ ...row, status: row.status as SkillStatus });

export class PrismaSkillRepository implements SkillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Skill | null> {
    const row = await this.prisma.skill.findFirst({ where: { id, ...notDeleted }, select: skillSelect });
    return row && toSkill(row);
  }

  async findByName(skillCategoryId: bigint, name: string): Promise<Skill | null> {
    // Igual que el índice único de la BD: (skill_category_id, lower(name)).
    const row = await this.prisma.skill.findFirst({
      where: { skillCategoryId, name: { equals: name, mode: "insensitive" } },
      select: skillSelect,
    });
    return row && toSkill(row);
  }

  async hasGradeHistory(id: bigint): Promise<boolean> {
    const [evaluation, grade] = await Promise.all([
      this.prisma.evaluationSkill.findFirst({
        where: { ...notDeleted, workshopSkill: { skillId: id } },
        select: { id: true },
      }),
      this.prisma.studentSkill.findFirst({ where: { skillId: id, ...notDeleted }, select: { id: true } }),
    ]);
    return evaluation !== null || grade !== null;
  }

  async findMany(filter: SkillFilter = {}): Promise<Skill[]> {
    const where: Prisma.SkillWhereInput = filter.includeDeleted ? {} : { ...notDeleted };
    if (filter.skillCategoryId !== undefined) where.skillCategoryId = filter.skillCategoryId;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.search) where.name = { contains: filter.search, mode: "insensitive" };
    const rows = await this.prisma.skill.findMany({ where, select: skillSelect, orderBy: { name: "asc" } });
    return rows.map(toSkill);
  }

  async existsInCategory(skillCategoryId: bigint): Promise<boolean> {
    const row = await this.prisma.skill.findFirst({ where: { skillCategoryId, ...notDeleted }, select: { id: true } });
    return row !== null;
  }

  create(data: CreateSkillInput, actor: ActorId): Promise<Skill> {
    return withPrismaErrors("Habilidad", async () =>
      toSkill(await this.prisma.skill.create({ data: { ...data, ...audit.create(actor) }, select: skillSelect })),
    );
  }

  update(id: bigint, data: UpdateSkillInput, actor: ActorId): Promise<Skill> {
    return withPrismaErrors("Habilidad", async () =>
      toSkill(
        await this.prisma.skill.update({ where: { id }, data: { ...data, ...audit.update(actor) }, select: skillSelect }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Habilidad", () =>
      this.prisma.skill.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
