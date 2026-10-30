import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { decimalToNumber } from "../../shared/infrastructure/prisma/mappers.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { EvaluateSkillInput, EvaluationSkill, StudentSkillPair } from "../domain/evaluation-skill.entity.js";
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
        attendance: { studentId, ...notDeleted },
        workshopSkill: { skillId, ...notDeleted },
      },
      select: { scale: { select: { numValue: true } } },
      orderBy: [{ attendance: { attendedAt: "asc" } }, { id: "asc" }],
    });
    return rows.map((row) => decimalToNumber(row.scale.numValue));
  }

  findGradedPairsByAttendance(workshopAttendanceId: bigint): Promise<StudentSkillPair[]> {
    return this.findGradedPairs({ workshopAttendanceId });
  }

  findGradedPairsByWorkshopSkill(workshopSkillId: bigint): Promise<StudentSkillPair[]> {
    return this.findGradedPairs({ workshopSkillId });
  }

  // No filtra la asistencia ni la habilidad del taller: se usa justo después de eliminarlas.
  private async findGradedPairs(where: Prisma.EvaluationSkillWhereInput): Promise<StudentSkillPair[]> {
    const rows = await this.prisma.evaluationSkill.findMany({
      where: { ...where, ...notDeleted },
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
