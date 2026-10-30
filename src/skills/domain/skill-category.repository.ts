import type { ActorId } from "../../shared/domain/auditable.js";
import type { CreateSkillCategoryInput, SkillCategory, UpdateSkillCategoryInput } from "./skill-category.entity.js";

export interface SkillCategoryRepository {
  findById(id: bigint): Promise<SkillCategory | null>;
  /** Sin distinguir mayúsculas. Incluye eliminadas: el nombre es único en toda la tabla. */
  findByName(name: string): Promise<SkillCategory | null>;
  findAll(): Promise<SkillCategory[]>;
  create(data: CreateSkillCategoryInput, actor: ActorId): Promise<SkillCategory>;
  update(id: bigint, data: UpdateSkillCategoryInput, actor: ActorId): Promise<SkillCategory>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
