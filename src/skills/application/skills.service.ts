import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import type { SkillCategoryRepository } from "../domain/skill-category.repository.js";
import type { CreateSkillInput, Skill, SkillFilter, UpdateSkillInput } from "../domain/skill.entity.js";
import type { SkillRepository } from "../domain/skill.repository.js";
import { createSkillSchema, updateSkillSchema } from "./skill.schemas.js";

/** Habilidades (docs/VALIDACIONES.md §3.3). */
export class SkillsService {
  constructor(
    private readonly skills: SkillRepository,
    private readonly categories: SkillCategoryRepository,
  ) {}

  list(filter?: SkillFilter): Promise<Skill[]> {
    return this.skills.findMany(filter);
  }

  async get(id: bigint): Promise<Skill> {
    const skill = await this.skills.findById(id);
    if (!skill) throw new NotFoundError("Habilidad", id);
    return skill;
  }

  async create(data: CreateSkillInput, actor: ActorId): Promise<Skill> {
    const input = parseInput(createSkillSchema, data, "Habilidad");
    await this.ensureCategoryExists(input.skillCategoryId);
    await this.ensureNameAvailable(input.skillCategoryId, input.name);
    return this.skills.create(input, actor);
  }

  /**
   * Se puede cambiar de categoría aunque tenga calificaciones (los promedios por
   * categoría se calculan al consultarlos) y se puede inactivar aunque esté en
   * talleres en curso (ya no se asocia a talleres nuevos, pero se sigue evaluando).
   */
  async update(id: bigint, data: UpdateSkillInput, actor: ActorId): Promise<Skill> {
    const input = parseInput(updateSkillSchema, data, "Habilidad");
    const current = await this.get(id);
    if (input.skillCategoryId !== undefined) await this.ensureCategoryExists(input.skillCategoryId);

    // El nombre es único por categoría: se valida contra la categoría final.
    if (input.name !== undefined || input.skillCategoryId !== undefined) {
      await this.ensureNameAvailable(input.skillCategoryId ?? current.skillCategoryId, input.name ?? current.name, id);
    }
    return this.skills.update(id, input, actor);
  }

  /** Solo se elimina si no tiene historial; si lo tiene, se debe inactivar. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    if (await this.skills.hasGradeHistory(id)) {
      throw new ConflictError("La habilidad tiene evaluaciones o calificaciones: inactívela en lugar de eliminarla");
    }
    await this.skills.delete(id, actor);
  }

  private async ensureCategoryExists(skillCategoryId: bigint) {
    if (!(await this.categories.findById(skillCategoryId))) {
      throw new NotFoundError("Categoría de habilidad", skillCategoryId);
    }
  }

  private async ensureNameAvailable(skillCategoryId: bigint, name: string, excludeId?: bigint) {
    const existing = await this.skills.findByName(skillCategoryId, name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una habilidad llamada "${name}" en esa categoría`);
    }
  }
}
