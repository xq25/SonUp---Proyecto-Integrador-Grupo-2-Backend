import type { ChildReader } from "../../administrative/domain/child.reader.js";
import type { EvaluationScaleRepository } from "../../evaluations/domain/evaluation-scale.repository.js";
import type { EvaluationSkillRepository } from "../../evaluations/domain/evaluation-skill.repository.js";
import type { EvaluationScale } from "../../evaluations/domain/evaluation-scale.entity.js";
import type { GradeTimelineEntry } from "../../evaluations/domain/evaluation-skill.entity.js";
import { accumulateSkillGrade, average, findScaleForValue } from "../../evaluations/domain/grading.js";
import { monthInAppTimeZone, monthsBetween } from "../../shared/domain/dates.js";
import { NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type {
  CategoryAverage,
  GradeScaleSummary,
  MonthlyAverage,
  MonthlyCategoryAverage,
  MonthlyProgress,
  MonthlySkillGrade,
  StudentProgress,
  StudentProgressQuery,
  StudentSkillDetail,
} from "../domain/student-skill.entity.js";
import type { StudentSkillRepository } from "../domain/student-skill.repository.js";

/**
 * Calificaciones de cada estudiante por habilidad y sus promedios por categoría.
 * Solo consulta: la calificación de cada habilidad la calcula GradingService al evaluar.
 */
export class StudentSkillsService {
  constructor(
    private readonly studentSkills: StudentSkillRepository,
    private readonly scales: EvaluationScaleRepository,
    private readonly children: ChildReader,
    private readonly evaluations: EvaluationSkillRepository,
  ) {}

  async listByStudent(studentId: bigint): Promise<StudentSkillDetail[]> {
    await this.ensureStudentExists(studentId);
    return this.studentSkills.findByStudent(studentId);
  }

  /**
   * Promedio del estudiante por categoría de habilidades: suma de las
   * calificaciones (`numValue`) de sus habilidades en la categoría dividida
   * entre la cantidad de habilidades calificadas. Ej.: 3,4 en habilidades blandas.
   */
  async getCategoryAverages(studentId: bigint): Promise<CategoryAverage[]> {
    await this.ensureStudentExists(studentId);
    const grades = await this.studentSkills.findGrades(studentId);
    const scales = await this.scales.findAll(true);

    const byCategory = new Map<bigint, { name: string; values: number[] }>();
    for (const grade of grades) {
      const group = byCategory.get(grade.skillCategoryId) ?? { name: grade.categoryName, values: [] };
      group.values.push(grade.numValue);
      byCategory.set(grade.skillCategoryId, group);
    }

    return [...byCategory].map(([skillCategoryId, { name, values }]) => {
      const avg = average(values);
      const scale = findScaleForValue(scales, avg);
      return {
        skillCategoryId,
        categoryName: name,
        skillCount: values.length,
        average: avg,
        evaluationScaleId: scale?.id ?? null,
        scale: scale ? { id: scale.id, code: scale.code, name: scale.name, numValue: scale.numValue } : null,
      };
    });
  }

  /**
   * Progreso mes a mes: la calificación acumulada de cada habilidad al cierre de
   * cada mes (hora de Bogotá), con la misma fórmula de siempre ((anterior + nueva) / 2),
   * y los promedios por área y general. Solo cuentan las sesiones finalizadas.
   * El mes en curso sale con `partial: true` (lo acumulado hasta hoy). Un mes sin
   * sesiones repite lo que traía.
   */
  async getProgress(studentId: bigint, query: StudentProgressQuery = {}): Promise<StudentProgress> {
    await this.ensureStudentExists(studentId);
    const timeline = await this.evaluations.findGradeTimeline(studentId);
    const scales = await this.scales.findAll(true);

    const currentMonth = monthInAppTimeZone(new Date());
    const firstMonth = timeline[0] ? monthInAppTimeZone(timeline[0].sessionStartsAt) : currentMonth;
    const to = query.to ?? currentMonth;
    const from = query.from ?? (firstMonth < to ? firstMonth : to);
    if (from > to) throw new ValidationError("El mes inicial (from) no puede ser posterior al final (to)");
    const months = monthsBetween(from, to);
    if (months.length > MAX_PROGRESS_MONTHS) {
      throw new ValidationError(`El rango no puede pasar de ${MAX_PROGRESS_MONTHS} meses`);
    }

    // Valoraciones de cada habilidad en orden; se acumulan hasta el cierre de cada mes.
    const bySkill = new Map<bigint, GradeTimelineEntry[]>();
    for (const entry of timeline) bySkill.set(entry.skillId, [...(bySkill.get(entry.skillId) ?? []), entry]);

    return {
      studentId,
      from,
      to,
      months: months.map((month) => this.progressAt(month, month === currentMonth, timeline, bySkill, scales)),
    };
  }

  private progressAt(
    month: string,
    partial: boolean,
    timeline: GradeTimelineEntry[],
    bySkill: Map<bigint, GradeTimelineEntry[]>,
    scales: EvaluationScale[],
  ): MonthlyProgress {
    const skills: MonthlySkillGrade[] = [];
    for (const entries of bySkill.values()) {
      const upToMonth = entries.filter((e) => monthInAppTimeZone(e.sessionStartsAt) <= month);
      const scale = accumulateSkillGrade(upToMonth.map((e) => e.numValue), scales);
      if (!scale) continue;
      const { skillId, skillName, skillCategoryId, categoryName } = entries[0]!;
      skills.push({ skillId, skillName, skillCategoryId, categoryName, value: scale.numValue, scale: toSummary(scale) });
    }

    const byCategory = new Map<bigint, MonthlySkillGrade[]>();
    for (const grade of skills) byCategory.set(grade.skillCategoryId, [...(byCategory.get(grade.skillCategoryId) ?? []), grade]);
    const categories: MonthlyCategoryAverage[] = [...byCategory].map(([skillCategoryId, grades]) => ({
      skillCategoryId,
      categoryName: grades[0]!.categoryName,
      ...averageOf(grades, scales),
    }));

    return {
      month,
      partial,
      evaluationCount: timeline.filter((e) => monthInAppTimeZone(e.sessionStartsAt) === month).length,
      skills,
      categories,
      overall: skills.length > 0 ? averageOf(skills, scales) : null,
    };
  }

  private async ensureStudentExists(studentId: bigint) {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
  }
}

/** Máximo de meses por consulta de progreso (3 años). */
export const MAX_PROGRESS_MONTHS = 36;

const toSummary = (scale: EvaluationScale): GradeScaleSummary => ({
  id: scale.id,
  code: scale.code,
  name: scale.name,
  numValue: scale.numValue,
});

/** Promedio de calificaciones (redondeado a 2 decimales) y la escala en la que cae. */
function averageOf(grades: MonthlySkillGrade[], scales: EvaluationScale[]): MonthlyAverage {
  const avg = average(grades.map((g) => g.value));
  const scale = findScaleForValue(scales, avg);
  return { skillCount: grades.length, average: avg, scale: scale ? toSummary(scale) : null };
}
