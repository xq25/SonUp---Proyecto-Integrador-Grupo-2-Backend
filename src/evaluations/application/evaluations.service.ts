import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import { hasLeftFoundation } from "../../administrative/domain/administrative.entity.js";
import type { ChildReader } from "../../administrative/domain/administrative.readers.js";
import type { StudentSkill } from "../../skills/domain/skill.entity.js";
import type { Workshop } from "../../workshops/domain/workshop.entity.js";
import type {
  WorkshopAttendanceRepository,
  WorkshopRepository,
  WorkshopSkillRepository,
} from "../../workshops/domain/workshop.repository.js";
import { ensureCanEvaluate, ensureEvaluationRemovable } from "../domain/evaluation.rules.js";
import { createEvaluationScaleSchema, evaluateSkillSchema, updateEvaluationScaleSchema } from "./evaluation.schemas.js";
import { parseInput } from "../../shared/application/validation.js";
import {
  type CoverageGap,
  ensureValidScaleValues,
  findCoverageGaps,
  roundGrade,
} from "../domain/grading.js";
import type { SkillGradeRecalculator } from "../domain/skill-grade-recalculator.js";
import type {
  CreateEvaluationScaleInput,
  EvaluateSkillInput,
  EvaluationScale,
  EvaluationSkill,
  UpdateEvaluationScaleInput,
} from "../domain/evaluation.entity.js";
import type { EvaluationScaleRepository, EvaluationSkillRepository } from "../domain/evaluation.repository.js";

export class EvaluationsService {
  constructor(
    private readonly scales: EvaluationScaleRepository,
    private readonly evaluations: EvaluationSkillRepository,
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

  // ── Escalas ──

  listScales(activeOnly = true): Promise<EvaluationScale[]> {
    return this.scales.findAll(activeOnly);
  }

  async getScale(id: bigint): Promise<EvaluationScale> {
    const scale = await this.scales.findById(id);
    if (!scale) throw new NotFoundError("Escala de evaluación", id);
    return scale;
  }

  async createScale(data: CreateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale> {
    const input = parseInput(createEvaluationScaleSchema, data, "Escala de evaluación");
    await this.ensureCodeAvailable(input.code);
    await this.ensureNameAvailable(input.name);
    ensureValidScaleValues(input.numValue, input.minValue, input.maxValue);
    if (input.isActive ?? true) await this.ensureNoOverlap(input.minValue, input.maxValue);
    return this.scales.create(input, actor);
  }

  /**
   * Si la escala ya se usó en evaluaciones o calificaciones, solo se pueden
   * cambiar el nombre, la descripción y si está activa: el código y los valores
   * quedan fijos para que las calificaciones históricas no cambien.
   */
  async updateScale(id: bigint, data: UpdateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale> {
    const input = parseInput(updateEvaluationScaleSchema, data, "Escala de evaluación");
    const current = await this.getScale(id);

    const locked = (["code", "numValue", "minValue", "maxValue"] as const).filter(
      (field) => input[field] !== undefined && input[field] !== current[field],
    );
    if (locked.length > 0 && (await this.scales.isInUse(id))) {
      throw new ConflictError(
        `La escala ya se usó en calificaciones: no se puede cambiar ${locked.join(", ")} (solo nombre, descripción o estado)`,
      );
    }

    if (input.code) await this.ensureCodeAvailable(input.code, id);
    if (input.name) await this.ensureNameAvailable(input.name, id);
    // Se valida el resultado final: los valores nuevos combinados con los actuales.
    const minValue = input.minValue ?? current.minValue;
    const maxValue = input.maxValue ?? current.maxValue;
    ensureValidScaleValues(input.numValue ?? current.numValue, minValue, maxValue);
    if (input.isActive ?? current.isActive) await this.ensureNoOverlap(minValue, maxValue, id);
    return this.scales.update(id, input, actor);
  }

  /** Escala en la que se clasifica un valor (p. ej. un promedio de calificaciones), redondeado a 2 decimales. */
  async classify(value: number): Promise<EvaluationScale> {
    const rounded = roundGrade(value);
    const scale = await this.scales.findByValue(rounded);
    if (!scale) throw new ValidationError(`Ninguna escala activa contiene el valor ${rounded}`);
    return scale;
  }

  /** Tramos del rango 0–5 que ninguna escala activa cubre: un promedio ahí no se puede clasificar. */
  async getCoverageGaps(): Promise<CoverageGap[]> {
    return findCoverageGaps(await this.scales.findAll(true));
  }

  /** Solo se elimina si nunca se usó; si se usó, se debe inactivar. */
  async deleteScale(id: bigint, actor: ActorId): Promise<void> {
    await this.getScale(id);
    if (await this.scales.isInUse(id)) {
      throw new ConflictError("La escala ya se usó en calificaciones: inactívela en lugar de eliminarla");
    }
    await this.scales.delete(id, actor);
  }

  // ── Evaluación de habilidades ──

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

    const scale = await this.getScale(input.evaluationScaleId);
    if (!scale.isActive) throw new ValidationError("La escala de evaluación no está activa");

    const evaluation = await this.evaluations.upsert(input, actor);
    await this.grades.recalculate(attendance.studentId, workshopSkill.skillId, actor);
    return evaluation;
  }

  /** No se elimina con el taller cerrado (`finished`/`cancelled`). Recalcula la calificación. */
  async removeEvaluation(workshopAttendanceId: bigint, workshopSkillId: bigint, actor: ActorId): Promise<void> {
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

  private async ensureCodeAvailable(code: string, excludeId?: bigint) {
    const existing = await this.scales.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una escala con el código "${code}"`);
    }
  }

  private async ensureNameAvailable(name: string, excludeId?: bigint) {
    const existing = await this.scales.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una escala llamada "${name}"`);
    }
  }

  /** Los intervalos de escalas activas no se pueden solapar: cada promedio cae en una sola escala. */
  private async ensureNoOverlap(minValue: number, maxValue: number, excludeId?: bigint) {
    const overlapping = await this.scales.findOverlapping(minValue, maxValue, excludeId);
    if (overlapping.length > 0) {
      const names = overlapping.map((s) => `"${s.name}" [${s.minValue}, ${s.maxValue}]`).join(", ");
      throw new ConflictError(`El intervalo [${minValue}, ${maxValue}] se solapa con: ${names}`);
    }
  }
}
