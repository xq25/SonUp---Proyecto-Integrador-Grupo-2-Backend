import type { ChildReader } from "../../administrative/domain/child.reader.js";
import type { EvaluationScaleRepository } from "../../evaluations/domain/evaluation-scale.repository.js";
import { average, findScaleForValue } from "../../evaluations/domain/grading.js";
import { NotFoundError } from "../../shared/domain/errors.js";
import type { CategoryAverage, StudentSkill } from "../domain/student-skill.entity.js";
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
  ) {}

  async listByStudent(studentId: bigint): Promise<StudentSkill[]> {
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
      return {
        skillCategoryId,
        categoryName: name,
        skillCount: values.length,
        average: avg,
        evaluationScaleId: findScaleForValue(scales, avg)?.id ?? null,
      };
    });
  }

  private async ensureStudentExists(studentId: bigint) {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
  }
}
