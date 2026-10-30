import { hasLeftFoundation } from "../../administrative/domain/child.entity.js";
import type { ChildReader } from "../../administrative/domain/child.reader.js";
import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type { StudentSkill } from "../../skills/domain/student-skill.entity.js";
import type { Workshop } from "../../workshops/domain/workshop.entity.js";
import type { WorkshopRepository } from "../../workshops/domain/workshop.repository.js";
import type { WorkshopAttendanceRepository } from "../../workshops/domain/workshop-attendance.repository.js";
import type { WorkshopSkillRepository } from "../../workshops/domain/workshop-skill.repository.js";
import type { EvaluationScaleRepository } from "../domain/evaluation-scale.repository.js";
import type { EvaluateSkillInput, EvaluationSkill } from "../domain/evaluation-skill.entity.js";
import type { EvaluationSkillRepository } from "../domain/evaluation-skill.repository.js";
import { ensureCanEvaluate, ensureEvaluationRemovable } from "../domain/evaluation-skill.rules.js";
import type { SkillGradeRecalculator } from "../domain/skill-grade-recalculator.js";
import { evaluateSkillSchema } from "./evaluation-skill.schemas.js";

/** Evaluación de habilidades en una asistencia (docs/VALIDACIONES.md §3.9). */
export class EvaluationsService {
  constructor(
    private readonly evaluations: EvaluationSkillRepository,
    private readonly scales: EvaluationScaleRepository,
    private readonly attendances: WorkshopAttendanceRepository,
    private readonly workshopSkills: WorkshopSkillRepository,
    private readonly grades: SkillGradeRecalculator,
    private readonly children: ChildReader,
    private readonly workshops: WorkshopRepository,
  ) {}

  private async getWorkshop(workshopId: bigint): Promise<Workshop> {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) throw new NotFoundError("Taller", workshopId);
    return workshop;
  }

  async listByAttendance(workshopAttendanceId: bigint): Promise<EvaluationSkill[]> {
    if (!(await this.attendances.findById(workshopAttendanceId))) {
      throw new NotFoundError("Asistencia", workshopAttendanceId);
    }
    return this.evaluations.findByAttendance(workshopAttendanceId);
  }

  /**
   * Evalúa (o reevalúa) una habilidad del taller en una asistencia y
   * recalcula la calificación de esa habilidad en el estudiante.
   * Reglas (§3.9): taller `active`, estudiante activo, habilidad del mismo taller
   * de la asistencia y escala activa.
   */
  async evaluate(data: EvaluateSkillInput, actor: ActorId): Promise<EvaluationSkill> {
    const input = parseInput(evaluateSkillSchema, data, "Evaluación");
    const attendance = await this.attendances.findById(input.workshopAttendanceId);
    if (!attendance) throw new NotFoundError("Asistencia", input.workshopAttendanceId);
    ensureCanEvaluate(await this.getWorkshop(attendance.workshopId));

    const child = await this.children.findById(attendance.studentId);
    if (!child) throw new NotFoundError("Estudiante", attendance.studentId);
    if (hasLeftFoundation(child)) {
      throw new ValidationError("El estudiante ya salió de la fundación: no se le pueden registrar evaluaciones");
    }

    const workshopSkill = await this.workshopSkills.findById(input.workshopSkillId);
    if (!workshopSkill) throw new NotFoundError("Habilidad del taller", input.workshopSkillId);
    if (workshopSkill.workshopId !== attendance.workshopId) {
      throw new ValidationError("La habilidad no pertenece al taller de la asistencia");
    }

    const scale = await this.scales.findById(input.evaluationScaleId);
    if (!scale) throw new NotFoundError("Escala de evaluación", input.evaluationScaleId);
    if (!scale.isActive) throw new ValidationError("La escala de evaluación no está activa");

    const evaluation = await this.evaluations.upsert(input, actor);
    await this.grades.recalculate(attendance.studentId, workshopSkill.skillId, actor);
    return evaluation;
  }

  /** No se elimina con el taller cerrado (`finished`/`cancelled`). Recalcula la calificación. */
  async remove(workshopAttendanceId: bigint, workshopSkillId: bigint, actor: ActorId): Promise<void> {
    const evaluation = await this.evaluations.find(workshopAttendanceId, workshopSkillId);
    if (!evaluation) throw new NotFoundError("Evaluación");
    const attendance = await this.attendances.findById(workshopAttendanceId);
    const workshopSkill = await this.workshopSkills.findById(workshopSkillId);
    if (workshopSkill) ensureEvaluationRemovable(await this.getWorkshop(workshopSkill.workshopId));

    await this.evaluations.delete(evaluation.id, actor);
    if (attendance && workshopSkill) {
      await this.grades.recalculate(attendance.studentId, workshopSkill.skillId, actor);
    }
  }

  /** Recalcula a mano la calificación de una habilidad en un estudiante (p. ej. tras cambiar escalas). */
  recalculateStudentSkill(studentId: bigint, skillId: bigint, actor: ActorId): Promise<StudentSkill | null> {
    return this.grades.recalculate(studentId, skillId, actor);
  }
}
