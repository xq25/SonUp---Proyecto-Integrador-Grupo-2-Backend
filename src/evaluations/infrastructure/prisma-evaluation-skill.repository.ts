import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { decimalToNumber } from "../../shared/infrastructure/prisma/mappers.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  EvaluateSkillInput,
  EvaluationSkill,
  GradeTimelineEntry,
  StudentSkillPair,
} from "../domain/evaluation-skill.entity.js";
import type { EvaluationSkillRepository } from "../domain/evaluation-skill.repository.js";

const evaluationSelect = {
  id: true,
  workshopAttendanceId: true,
  workshopSkillId: true,
  evaluationScaleId: true,
  ...auditSelect,
} satisfies Prisma.EvaluationSkillSelect;

export class PrismaEvaluationSkillRepository implements EvaluationSkillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  find(workshopAttendanceId: bigint, workshopSkillId: bigint): Promise<EvaluationSkill | null> {
    return this.prisma.evaluationSkill.findFirst({
      where: { workshopAttendanceId, workshopSkillId, ...notDeleted },
      select: evaluationSelect,
    });
  }

  findByAttendance(workshopAttendanceId: bigint): Promise<EvaluationSkill[]> {
    return this.prisma.evaluationSkill.findMany({
      where: { workshopAttendanceId, ...notDeleted },
      select: evaluationSelect,
      orderBy: { workshopSkillId: "asc" },
    });
  }

  async findGradeHistory(studentId: bigint, skillId: bigint): Promise<number[]> {
    const rows = await this.prisma.evaluationSkill.findMany({
      where: {
        ...notDeleted,
        attendance: { studentId, ...notDeleted, session: { status: "finished", ...notDeleted } },
        workshopSkill: { skillId, ...notDeleted },
      },
      select: { scale: { select: { numValue: true } } },
      orderBy: [{ attendance: { session: { startsAt: "asc" } } }, { id: "asc" }],
    });
    return rows.map((row) => decimalToNumber(row.scale.numValue));
  }

  async findGradeTimeline(studentId: bigint): Promise<GradeTimelineEntry[]> {
    const rows = await this.prisma.evaluationSkill.findMany({
      where: {
        ...notDeleted,
        attendance: { studentId, ...notDeleted, session: { status: "finished", ...notDeleted } },
        workshopSkill: { ...notDeleted },
      },
      select: {
        scale: { select: { numValue: true } },
        attendance: { select: { session: { select: { startsAt: true } } } },
        workshopSkill: {
          select: { skill: { select: { id: true, name: true, category: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: [{ attendance: { session: { startsAt: "asc" } } }, { id: "asc" }],
    });
    return rows.map((row) => ({
      skillId: row.workshopSkill.skill.id,
      skillName: row.workshopSkill.skill.name,
      skillCategoryId: row.workshopSkill.skill.category.id,
      categoryName: row.workshopSkill.skill.category.name,
      numValue: decimalToNumber(row.scale.numValue),
      sessionStartsAt: row.attendance.session.startsAt,
    }));
  }

  async findGradedPairsBySession(workshopSessionId: bigint): Promise<StudentSkillPair[]> {
    const rows = await this.prisma.evaluationSkill.findMany({
      where: { ...notDeleted, attendance: { sessionId: workshopSessionId, ...notDeleted } },
      select: { attendance: { select: { studentId: true } }, workshopSkill: { select: { skillId: true } } },
    });
    const unique = new Map<string, StudentSkillPair>();
    for (const row of rows) {
      const pair = { studentId: row.attendance.studentId, skillId: row.workshopSkill.skillId };
      unique.set(`${pair.studentId}:${pair.skillId}`, pair);
    }
    return [...unique.values()];
  }

  upsert(data: EvaluateSkillInput, actor: ActorId): Promise<EvaluationSkill> {
    const { workshopAttendanceId, workshopSkillId, evaluationScaleId } = data;
    return withPrismaErrors("Evaluación", () =>
      this.prisma.evaluationSkill.upsert({
        where: { workshopAttendanceId_workshopSkillId: { workshopAttendanceId, workshopSkillId } },
        create: { workshopAttendanceId, workshopSkillId, evaluationScaleId, ...audit.create(actor) },
        // Si existía (vigente o eliminada) se cambia la escala y queda vigente.
        update: { evaluationScaleId, ...audit.restore(actor) },
        select: evaluationSelect,
      }),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Evaluación", () =>
      this.prisma.evaluationSkill.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
