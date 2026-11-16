import type { SkillGradeRecalculator } from "../../evaluations/domain/skill-grade-recalculator.js";
import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { NotFoundError } from "../../shared/domain/errors.js";
import type { Workshop } from "../domain/workshop.entity.js";
import type { WorkshopRepository } from "../domain/workshop.repository.js";
import type {
  CreateWorkshopSessionInput,
  FinishWorkshopSessionInput,
  UpdateWorkshopSessionInput,
  WorkshopSession,
} from "../domain/workshop-session.entity.js";
import type { WorkshopSessionRepository } from "../domain/workshop-session.repository.js";
import {
  ensureCanFinishSession,
  ensureCanStartSession,
  ensureNoOverlap,
  ensureSessionDeletable,
  ensureSessionEditable,
  ensureValidSessionWindow,
  ensureWorkshopAcceptsSessions,
} from "../domain/workshop-session.rules.js";
import {
  createWorkshopSessionSchema,
  finishWorkshopSessionSchema,
  updateWorkshopSessionSchema,
} from "./workshop-session.schemas.js";

/**
 * Sesiones de un taller y su ciclo de vida (docs/VALIDACIONES.md §3.13, ADR-009):
 * `planned` (horario tentativo) → `in_progress` (asistencia y evaluación) → `finished`.
 * Al finalizar una sesión, sus evaluaciones se cargan a las calificaciones de los jóvenes.
 */
export class WorkshopSessionsService {
  constructor(
    private readonly sessions: WorkshopSessionRepository,
    private readonly workshops: WorkshopRepository,
    private readonly grades: SkillGradeRecalculator,
  ) {}

  async get(id: bigint): Promise<WorkshopSession> {
    const session = await this.sessions.findById(id);
    if (!session) throw new NotFoundError("Sesión", id);
    return session;
  }

  /** Sesiones del taller, en orden de inicio. */
  async listByWorkshop(workshopId: bigint): Promise<WorkshopSession[]> {
    await this.getWorkshop(workshopId);
    return this.sessions.findByWorkshop(workshopId);
  }

  /** Nace `planned`, dentro de las fechas del taller y sin cruzarse con otra sesión. */
  async create(workshopId: bigint, data: CreateWorkshopSessionInput, actor: ActorId): Promise<WorkshopSession> {
    const input = parseInput(createWorkshopSessionSchema, data, "Sesión");
    const workshop = await this.getWorkshop(workshopId);
    ensureWorkshopAcceptsSessions(workshop);
    ensureValidSessionWindow(workshop, input);
    ensureNoOverlap(await this.sessions.findByWorkshop(workshopId), input);
    return this.sessions.create(workshopId, input, actor);
  }

  /** En `planned` se edita todo; en `in_progress`, solo el contenido. Se valida el resultado final. */
  async update(id: bigint, data: UpdateWorkshopSessionInput, actor: ActorId): Promise<WorkshopSession> {
    const input = parseInput(updateWorkshopSessionSchema, data, "Sesión");
    const current = await this.get(id);
    const workshop = await this.getWorkshop(current.workshopId);
    ensureWorkshopAcceptsSessions(workshop);
    ensureSessionEditable(current, input);

    const window = { startsAt: input.startsAt ?? current.startsAt, endsAt: input.endsAt ?? current.endsAt };
    if (current.status === "planned") {
      ensureValidSessionWindow(workshop, window);
      ensureNoOverlap(await this.sessions.findByWorkshop(current.workshopId), window, id);
    }
    return this.sessions.update(id, input, actor);
  }

  /** Abre la asistencia y la evaluación de la sesión. */
  async start(id: bigint, actor: ActorId): Promise<WorkshopSession> {
    const session = await this.get(id);
    const workshop = await this.getWorkshop(session.workshopId);
    ensureCanStartSession(workshop, session, await this.sessions.findByWorkshop(session.workshopId));
    return this.sessions.update(id, { status: "in_progress" }, actor);
  }

  /** Guarda el fin real y carga las evaluaciones de la sesión a las calificaciones. */
  async finish(id: bigint, data: FinishWorkshopSessionInput, actor: ActorId): Promise<WorkshopSession> {
    const input = parseInput(finishWorkshopSessionSchema, data ?? {}, "Fin de la sesión");
    const session = await this.get(id);
    const workshop = await this.getWorkshop(session.workshopId);
    const endsAt = input.endsAt ?? new Date();
    ensureCanFinishSession(workshop, session, endsAt, await this.sessions.findByWorkshop(session.workshopId));

    const finished = await this.sessions.update(id, { status: "finished", endsAt }, actor);
    await this.grades.recalculateForSession(id, actor);
    return finished;
  }

  /** Solo una sesión `planned` (sin asistencias), con el taller abierto. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    const session = await this.get(id);
    ensureWorkshopAcceptsSessions(await this.getWorkshop(session.workshopId));
    ensureSessionDeletable(session);
    await this.sessions.delete(id, actor);
  }

  private async getWorkshop(workshopId: bigint): Promise<Workshop> {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) throw new NotFoundError("Taller", workshopId);
    return workshop;
  }
}
