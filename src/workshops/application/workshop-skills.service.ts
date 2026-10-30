import type { SkillGradeRecalculator } from "../../evaluations/domain/skill-grade-recalculator.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type { SkillRepository } from "../../skills/domain/skill.repository.js";
import type { Workshop } from "../domain/workshop.entity.js";
import type { WorkshopRepository } from "../domain/workshop.repository.js";
import type { WorkshopSkill } from "../domain/workshop-skill.entity.js";
import type { WorkshopSkillRepository } from "../domain/workshop-skill.repository.js";

/** Habilidades que se trabajan en cada taller (docs/VALIDACIONES.md §3.7). */
export class WorkshopSkillsService {
  constructor(
    private readonly workshopSkills: WorkshopSkillRepository,
    private readonly workshops: WorkshopRepository,
    private readonly skills: SkillRepository,
    private readonly grades: SkillGradeRecalculator,
  ) {}

  async listByWorkshop(workshopId: bigint): Promise<WorkshopSkill[]> {
    await this.getWorkshop(workshopId);
    return this.workshopSkills.findByWorkshop(workshopId);
  }

  /** Las habilidades se definen mientras el taller está `planned`. */
  async add(workshopId: bigint, skillId: bigint, actor: ActorId): Promise<WorkshopSkill> {
    await this.ensurePlanned(workshopId);
    const skill = await this.skills.findById(skillId);
    if (!skill) throw new NotFoundError("Habilidad", skillId);
    if (skill.status !== "active") throw new ValidationError("La habilidad no está activa");
    if (await this.workshopSkills.find(workshopId, skillId)) {
      throw new ConflictError("La habilidad ya está asociada al taller");
    }
    const relation = await this.workshopSkills.create(workshopId, skillId, actor);
    // Si se restauró una relación que ya tenía evaluaciones, vuelven a contar en las calificaciones.
    await this.grades.recalculateForWorkshopSkill(relation.id, actor);
    return relation;
  }

  /**
   * Solo con el taller `planned` y si la habilidad no tiene evaluaciones vigentes.
   * Recalcula por seguridad (p. ej. evaluaciones de asistencias ya eliminadas).
   */
  async remove(workshopId: bigint, skillId: bigint, actor: ActorId): Promise<void> {
    await this.ensurePlanned(workshopId);
    const relation = await this.workshopSkills.find(workshopId, skillId);
    if (!relation) throw new NotFoundError("Habilidad del taller");
    if (await this.workshopSkills.hasEvaluations(relation.id)) {
      throw new ConflictError("La habilidad ya tiene evaluaciones en este taller: no se puede quitar");
    }
    await this.workshopSkills.delete(relation.id, actor);
    await this.grades.recalculateForWorkshopSkill(relation.id, actor);
  }

  private async getWorkshop(workshopId: bigint): Promise<Workshop> {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) throw new NotFoundError("Taller", workshopId);
    return workshop;
  }

  private async ensurePlanned(workshopId: bigint) {
    const workshop = await this.getWorkshop(workshopId);
    if (workshop.status !== "planned") {
      throw new ConflictError(`Las habilidades solo se cambian con el taller "planned"; este está "${workshop.status}"`);
    }
  }
}
