import type { ProfessionalReader } from "../../administrative/domain/professional.reader.js";
import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type { CreateWorkshopInput, UpdateWorkshopInput, Workshop, WorkshopFilter } from "../domain/workshop.entity.js";
import type { WorkshopRepository } from "../domain/workshop.repository.js";
import {
  INITIAL_WORKSHOP_STATUS,
  ensureCanTransition,
  ensureEditable,
  ensureStatusRequirements,
} from "../domain/workshop.rules.js";
import type { WorkshopSkillRepository } from "../domain/workshop-skill.repository.js";
import { createWorkshopSchema, updateWorkshopSchema } from "./workshop.schemas.js";

/** Talleres y su ciclo de vida (docs/VALIDACIONES.md §3.6). */
export class WorkshopsService {
  constructor(
    private readonly workshops: WorkshopRepository,
    private readonly workshopSkills: WorkshopSkillRepository,
    private readonly professionals: ProfessionalReader,
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

  private async ensureEvaluatorExists(evaluatorId: bigint) {
    if (!(await this.professionals.findById(evaluatorId))) {
      throw new NotFoundError("Tallerista", evaluatorId);
    }
  }
}
