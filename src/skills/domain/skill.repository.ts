import type { ActorId } from "../../shared/domain/auditable.js";
import type { CreateSkillInput, Skill, SkillFilter, UpdateSkillInput } from "./skill.entity.js";

export interface SkillRepository {
  findById(id: bigint): Promise<Skill | null>;
  /**
   * Habilidad con ese nombre en la categoría, sin distinguir mayúsculas.
   * Incluye eliminadas: el nombre es único por categoría en toda la tabla.
   */
  findByName(skillCategoryId: bigint, name: string): Promise<Skill | null>;
  /** ¿Tiene evaluaciones en talleres o calificaciones de estudiantes vigentes? */
  hasGradeHistory(id: bigint): Promise<boolean>;
  findMany(filter?: SkillFilter): Promise<Skill[]>;
  /** ¿La categoría tiene habilidades vigentes? */
  existsInCategory(skillCategoryId: bigint): Promise<boolean>;
  create(data: CreateSkillInput, actor: ActorId): Promise<Skill>;
  update(id: bigint, data: UpdateSkillInput, actor: ActorId): Promise<Skill>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
