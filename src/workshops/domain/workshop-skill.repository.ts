import type { ActorId } from "../../shared/domain/auditable.js";
import type { WorkshopSkill } from "./workshop-skill.entity.js";

export interface WorkshopSkillRepository {
  findById(id: bigint): Promise<WorkshopSkill | null>;
  /** Relación vigente (no eliminada). */
  find(workshopId: bigint, skillId: bigint): Promise<WorkshopSkill | null>;
  findByWorkshop(workshopId: bigint): Promise<WorkshopSkill[]>;
  /** ¿Tiene evaluaciones vigentes (evaluación y asistencia no eliminadas)? */
  hasEvaluations(id: bigint): Promise<boolean>;
  /** Crea la relación o restaura una eliminada (único por taller y habilidad). */
  create(workshopId: bigint, skillId: bigint, actor: ActorId): Promise<WorkshopSkill>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
