import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { decimalToNumber } from "../../shared/infrastructure/prisma/mappers.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  CreateSkillCategoryInput,
  CreateSkillInput,
  SetStudentSkillInput,
  Skill,
  SkillCategory,
  SkillFilter,
  SkillStatus,
  StudentSkill,
  StudentSkillGrade,
  UpdateSkillCategoryInput,
  UpdateSkillInput,
} from "../domain/skill.entity.js";
import type {
  SkillCategoryRepository,
  SkillRepository,
  StudentSkillRepository,
} from "../domain/skill.repository.js";

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

const studentSkillSelect = {
  id: true,
  studentId: true,
  skillId: true,
  evaluationScaleId: true,
  ...auditSelect,
} satisfies Prisma.StudentSkillSelect;

type StudentSkillRow = Prisma.StudentSkillGetPayload<{ select: typeof studentSkillSelect }>;

const toStudentSkill = (row: StudentSkillRow): StudentSkill => ({ ...row });

export class PrismaStudentSkillRepository implements StudentSkillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(studentId: bigint, skillId: bigint): Promise<StudentSkill | null> {
    const row = await this.prisma.studentSkill.findFirst({
      where: { studentId, skillId, ...notDeleted },
      select: studentSkillSelect,
    });
    return row && toStudentSkill(row);
  }

  async findByStudent(studentId: bigint): Promise<StudentSkill[]> {
    const rows = await this.prisma.studentSkill.findMany({
      where: { studentId, ...notDeleted },
      select: studentSkillSelect,
      orderBy: { skillId: "asc" },
    });
    return rows.map(toStudentSkill);
  }

  async findGrades(studentId: bigint): Promise<StudentSkillGrade[]> {
    const rows = await this.prisma.studentSkill.findMany({
      where: { studentId, ...notDeleted, skill: { ...notDeleted, category: notDeleted } },
      select: {
        skillId: true,
        scale: { select: { numValue: true } },
        skill: { select: { skillCategoryId: true, category: { select: { name: true } } } },
      },
    });
    return rows.map((row) => ({
      skillId: row.skillId,
      skillCategoryId: row.skill.skillCategoryId,
      categoryName: row.skill.category.name,
      numValue: decimalToNumber(row.scale.numValue),
    }));
  }

  upsert(data: SetStudentSkillInput, actor: ActorId): Promise<StudentSkill> {
    const { studentId, skillId, evaluationScaleId } = data;
    return withPrismaErrors("Habilidad del estudiante", async () =>
      toStudentSkill(
        await this.prisma.studentSkill.upsert({
          where: { studentId_skillId: { studentId, skillId } },
          create: { studentId, skillId, evaluationScaleId, ...audit.create(actor) },
          // Si existía (vigente o eliminado) se cambia la escala y queda vigente.
          update: { evaluationScaleId, ...audit.restore(actor) },
          select: studentSkillSelect,
        }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Habilidad del estudiante", () =>
      this.prisma.studentSkill.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
