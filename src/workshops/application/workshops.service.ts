import type { ActorId } from "../../shared/domain/auditable.js";
import { parseInput } from "../../shared/application/validation.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type { ProfessionalReader } from "../../administrative/domain/administrative.readers.js";
import type { SkillGradeRecalculator } from "../../evaluations/domain/skill-grade-recalculator.js";
import type { SkillRepository } from "../../skills/domain/skill.repository.js";
import type {
  CreateWorkshopInput,
  UpdateWorkshopInput,
  Workshop,
  WorkshopFilter,
  WorkshopSkill,
} from "../domain/workshop.entity.js";
import type { WorkshopRepository, WorkshopSkillRepository } from "../domain/workshop.repository.js";
import {
  INITIAL_WORKSHOP_STATUS,
  ensureCanTransition,
  ensureEditable,
  ensureStatusRequirements,
} from "../domain/workshop.rules.js";
import { createWorkshopSchema, updateWorkshopSchema } from "./workshop.schemas.js";

export class WorkshopsService {
  constructor(
    private readonly workshops: WorkshopRepository,
    private readonly workshopSkills: WorkshopSkillRepository,
    private readonly skills: SkillRepository,
    private readonly professionals: ProfessionalReader,
    private readonly grades: SkillGradeRecalculator,
  ) {}

  async get(id: bigint): Promise<Workshop> {
    const workshop = await this.workshops.findById(id);
    if (!workshop) throw new NotFoundError("Taller", id);
    return workshop;
  }

  list(filter?: WorkshopFilter): Promise<Workshop[]> {
    return this.workshops.findMany(filter);
  }

  /**
   * Todo taller nace `planned`; para activarlo se usa `update`.
   * La entrada se valida con su esquema (forma, nivel 1) antes de las reglas de negocio.
   */
  async create(data: CreateWorkshopInput, actor: ActorId): Promise<Workshop> {
    const input: CreateWorkshopInput = {
      ...parseInput(createWorkshopSchema, data, "Taller"),
      status: INITIAL_WORKSHOP_STATUS,
    };
    ensureStatusRequirements(INITIAL_WORKSHOP_STATUS, input.startsAt ?? null, input.endsAt ?? null);
    await this.ensureEvaluatorExists(input.evaluatorId);
    return this.workshops.create(input, actor);
  }

  /**
   * Solo un taller `planned` se edita libremente. Uno `active` solo cambia de
   * estado (al finalizar puede recibir `endsAt`). `finished` y `cancelled` son finales.
   * Se valida el resultado final: valores nuevos combinados con los actuales.
   */
  async update(id: bigint, data: UpdateWorkshopInput, actor: ActorId): Promise<Workshop> {
    const input = parseInput(updateWorkshopSchema, data, "Taller");
    const current = await this.get(id);

    ensureEditable(current, input);
    const status = input.status ?? current.status;
    ensureCanTransition(current.status, status);
    const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt;
    ensureStatusRequirements(status, input.startsAt !== undefined ? input.startsAt : current.startsAt, endsAt);
    // Al finalizar, el fin no puede dejar asistencias por fuera de las fechas del taller (§3.8).
    if (status === "finished" && endsAt) {
      const lastAttendedAt = await this.workshops.findLastAttendedAt(id);
      if (lastAttendedAt && endsAt < lastAttendedAt) {
        throw new ValidationError("La fecha de fin no puede ser anterior a la última asistencia registrada");
      }
    }
    if (input.evaluatorId !== undefined) await this.ensureEvaluatorExists(input.evaluatorId);
    // Sin habilidades no habría nada que evaluar en las asistencias.
    if (status === "active" && current.status !== "active") {
      if ((await this.workshopSkills.findByWorkshop(id)).length === 0) {
        throw new ValidationError("Un taller necesita al menos una habilidad para activarse");
      }
    }
    return this.workshops.update(id, input, actor);
  }

  /** Solo se elimina si no tiene asistencias; si las tiene, se cancela. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    if (await this.workshops.hasAttendances(id)) {
      throw new ConflictError("El taller tiene asistencias: cancélelo en lugar de eliminarlo");
    }
    await this.workshops.delete(id, actor);
  }

  // ── Habilidades del taller ──

  async listSkills(workshopId: bigint): Promise<WorkshopSkill[]> {
    await this.get(workshopId);
    return this.workshopSkills.findByWorkshop(workshopId);
  }

  /** Las habilidades se definen mientras el taller está `planned`. */
  async addSkill(workshopId: bigint, skillId: bigint, actor: ActorId): Promise<WorkshopSkill> {
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
  async removeSkill(workshopId: bigint, skillId: bigint, actor: ActorId): Promise<void> {
    await this.ensurePlanned(workshopId);
    const relation = await this.workshopSkills.find(workshopId, skillId);
    if (!relation) throw new NotFoundError("Habilidad del taller");
    if (await this.workshopSkills.hasEvaluations(relation.id)) {
      throw new ConflictError("La habilidad ya tiene evaluaciones en este taller: no se puede quitar");
    }
    await this.workshopSkills.delete(relation.id, actor);
    await this.grades.recalculateForWorkshopSkill(relation.id, actor);
  }

  private async ensurePlanned(workshopId: bigint) {
    const workshop = await this.get(workshopId);
    if (workshop.status !== "planned") {
      throw new ConflictError(`Las habilidades solo se cambian con el taller "planned"; este está "${workshop.status}"`);
    }
  }

  private async ensureEvaluatorExists(evaluatorId: bigint) {
    if (!(await this.professionals.findById(evaluatorId))) {
      throw new NotFoundError("Tallerista", evaluatorId);
    }
  }
}
