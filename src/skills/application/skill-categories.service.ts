import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import type {
  CreateSkillCategoryInput,
  SkillCategory,
  UpdateSkillCategoryInput,
} from "../domain/skill-category.entity.js";
import type { SkillCategoryRepository } from "../domain/skill-category.repository.js";
import type { SkillRepository } from "../domain/skill.repository.js";
import { createSkillCategorySchema, updateSkillCategorySchema } from "./skill-category.schemas.js";

/** Categorías de habilidades (docs/VALIDACIONES.md §3.2). */
export class SkillCategoriesService {
  constructor(
    private readonly categories: SkillCategoryRepository,
    private readonly skills: SkillRepository,
  ) {}

  list(): Promise<SkillCategory[]> {
    return this.categories.findAll();
  }

  async get(id: bigint): Promise<SkillCategory> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundError("Categoría de habilidad", id);
    return category;
  }

  async create(data: CreateSkillCategoryInput, actor: ActorId): Promise<SkillCategory> {
    const input = parseInput(createSkillCategorySchema, data, "Categoría de habilidad");
    await this.ensureNameAvailable(input.name);
    return this.categories.create(input, actor);
  }

  /** Se puede renombrar aunque tenga calificaciones: los promedios se agrupan por id. */
  async update(id: bigint, data: UpdateSkillCategoryInput, actor: ActorId): Promise<SkillCategory> {
    const input = parseInput(updateSkillCategorySchema, data, "Categoría de habilidad");
    await this.get(id);
    if (input.name) await this.ensureNameAvailable(input.name, id);
    return this.categories.update(id, input, actor);
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    if (await this.skills.existsInCategory(id)) {
      throw new ConflictError("La categoría tiene habilidades vigentes");
    }
    await this.categories.delete(id, actor);
  }

  private async ensureNameAvailable(name: string, excludeId?: bigint) {
    const existing = await this.categories.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una categoría llamada "${name}"`);
    }
  }
}
