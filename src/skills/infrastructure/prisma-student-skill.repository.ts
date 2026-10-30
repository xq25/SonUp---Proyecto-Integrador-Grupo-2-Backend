import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { decimalToNumber } from "../../shared/infrastructure/prisma/mappers.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { SetStudentSkillInput, StudentSkill, StudentSkillGrade } from "../domain/student-skill.entity.js";
import type { StudentSkillRepository } from "../domain/student-skill.repository.js";

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
