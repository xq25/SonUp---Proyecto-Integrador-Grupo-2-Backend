import type { ActorId } from "../../shared/domain/auditable.js";
import type { StudentSkill } from "../../skills/domain/student-skill.entity.js";
import type { StudentSkillRepository } from "../../skills/domain/student-skill.repository.js";
import type { EvaluationScaleRepository } from "../domain/evaluation-scale.repository.js";
import type { StudentSkillPair } from "../domain/evaluation-skill.entity.js";
import type { EvaluationSkillRepository } from "../domain/evaluation-skill.repository.js";
import { accumulateSkillGrade } from "../domain/grading.js";
import type { SkillGradeRecalculator } from "../domain/skill-grade-recalculator.js";

/**
 * Recalcula las calificaciones (`student_skills`) a partir del historial de
 * evaluaciones: cada calificación nueva se promedia con la anterior,
 * `(anterior + nueva) / 2` (ver `accumulateSkillGrade`).
 *
 * Siempre parte del historial completo, así que reevaluar, eliminar una
 * evaluación, eliminar una asistencia o quitar una habilidad de un taller deja
 * el resultado correcto. Sin evaluaciones, la calificación se elimina.
 */
export class GradingService implements SkillGradeRecalculator {
  constructor(
    private readonly evaluations: EvaluationSkillRepository,
    private readonly scales: EvaluationScaleRepository,
    private readonly studentSkills: StudentSkillRepository,
  ) {}

  async recalculate(studentId: bigint, skillId: bigint, actor: ActorId): Promise<StudentSkill | null> {
    const history = await this.evaluations.findGradeHistory(studentId, skillId);
    const scale = accumulateSkillGrade(history, await this.scales.findAll(true));

    if (!scale) {
      const current = await this.studentSkills.find(studentId, skillId);
      if (current) await this.studentSkills.delete(current.id, actor);
      return null;
    }
    return this.studentSkills.upsert({ studentId, skillId, evaluationScaleId: scale.id }, actor);
  }

  async recalculateForAttendance(workshopAttendanceId: bigint, actor: ActorId): Promise<void> {
    await this.recalculateAll(await this.evaluations.findGradedPairsByAttendance(workshopAttendanceId), actor);
  }

  async recalculateForWorkshopSkill(workshopSkillId: bigint, actor: ActorId): Promise<void> {
    await this.recalculateAll(await this.evaluations.findGradedPairsByWorkshopSkill(workshopSkillId), actor);
  }

  private async recalculateAll(pairs: StudentSkillPair[], actor: ActorId) {
    for (const { studentId, skillId } of pairs) await this.recalculate(studentId, skillId, actor);
  }
}
