import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import { parseInput } from "../../shared/application/validation.js";
import type { ChildReader } from "../../administrative/domain/administrative.readers.js";
import type { EvaluationScaleRepository } from "../../evaluations/domain/evaluation.repository.js";
import { average, findScaleForValue } from "../../evaluations/domain/grading.js";
import type {
  CategoryAverage,
  CreateSkillCategoryInput,
  CreateSkillInput,
  Skill,
  SkillCategory,
  SkillFilter,
  StudentSkill,
  UpdateSkillCategoryInput,
  UpdateSkillInput,
} from "../domain/skill.entity.js";
import type {
  SkillCategoryRepository,
  SkillRepository,
  StudentSkillRepository,
} from "../domain/skill.repository.js";
import {
  createSkillCategorySchema,
  createSkillSchema,
  updateSkillCategorySchema,
  updateSkillSchema,
} from "./skill.schemas.js";

export class SkillsService {
  constructor(
    private readonly categories: SkillCategoryRepository,
    private readonly skills: SkillRepository,
    private readonly studentSkills: StudentSkillRepository,
    private readonly scales: EvaluationScaleRepository,
    private readonly children: ChildReader,
  ) {}

  // ── Categorías ──

  listCategories(): Promise<SkillCategory[]> {
    return this.categories.findAll();
  }

  async getCategory(id: bigint): Promise<SkillCategory> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundError("Categoría de habilidad", id);
    return category;
  }

  async createCategory(data: CreateSkillCategoryInput, actor: ActorId): Promise<SkillCategory> {
    const input = parseInput(createSkillCategorySchema, data, "Categoría de habilidad");
    await this.ensureCategoryNameAvailable(input.name);
    return this.categories.create(input, actor);
  }

  /** Se puede renombrar aunque tenga calificaciones: los promedios se agrupan por id. */
  async updateCategory(id: bigint, data: UpdateSkillCategoryInput, actor: ActorId): Promise<SkillCategory> {
    const input = parseInput(updateSkillCategorySchema, data, "Categoría de habilidad");
    await this.getCategory(id);
    if (input.name) await this.ensureCategoryNameAvailable(input.name, id);
    return this.categories.update(id, input, actor);
  }

  async deleteCategory(id: bigint, actor: ActorId): Promise<void> {
    await this.getCategory(id);
    if (await this.skills.existsInCategory(id)) {
      throw new ConflictError("La categoría tiene habilidades vigentes");
    }
    await this.categories.delete(id, actor);
  }

  // ── Habilidades ──

  listSkills(filter?: SkillFilter): Promise<Skill[]> {
    return this.skills.findMany(filter);
  }

  async getSkill(id: bigint): Promise<Skill> {
    const skill = await this.skills.findById(id);
    if (!skill) throw new NotFoundError("Habilidad", id);
    return skill;
  }

  async createSkill(data: CreateSkillInput, actor: ActorId): Promise<Skill> {
    const input = parseInput(createSkillSchema, data, "Habilidad");
    await this.getCategory(input.skillCategoryId);
    await this.ensureSkillNameAvailable(input.skillCategoryId, input.name);
    return this.skills.create(input, actor);
  }

  /**
   * Se puede cambiar de categoría aunque tenga calificaciones (los promedios por
   * categoría se calculan al consultarlos) y se puede inactivar aunque esté en
   * talleres en curso (ya no se asocia a talleres nuevos, pero se sigue evaluando).
   */
  async updateSkill(id: bigint, data: UpdateSkillInput, actor: ActorId): Promise<Skill> {
    const input = parseInput(updateSkillSchema, data, "Habilidad");
    const current = await this.getSkill(id);
    if (input.skillCategoryId !== undefined) await this.getCategory(input.skillCategoryId);

    // El nombre es único por categoría: se valida contra la categoría final.
    if (input.name !== undefined || input.skillCategoryId !== undefined) {
      await this.ensureSkillNameAvailable(
        input.skillCategoryId ?? current.skillCategoryId,
        input.name ?? current.name,
        id,
      );
    }
    return this.skills.update(id, input, actor);
  }

  /** Solo se elimina si no tiene historial; si lo tiene, se debe inactivar. */
  async deleteSkill(id: bigint, actor: ActorId): Promise<void> {
    await this.getSkill(id);
    if (await this.skills.hasGradeHistory(id)) {
      throw new ConflictError("La habilidad tiene evaluaciones o calificaciones: inactívela en lugar de eliminarla");
    }
    await this.skills.delete(id, actor);
  }

  // ── Habilidades por estudiante ──

  // La calificación de cada habilidad la calcula EvaluationsService al evaluar.

  async listStudentSkills(studentId: bigint): Promise<StudentSkill[]> {
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

  private async ensureCategoryNameAvailable(name: string, excludeId?: bigint) {
    const existing = await this.categories.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una categoría llamada "${name}"`);
    }
  }

  private async ensureSkillNameAvailable(skillCategoryId: bigint, name: string, excludeId?: bigint) {
    const existing = await this.skills.findByName(skillCategoryId, name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una habilidad llamada "${name}" en esa categoría`);
    }
  }
}
