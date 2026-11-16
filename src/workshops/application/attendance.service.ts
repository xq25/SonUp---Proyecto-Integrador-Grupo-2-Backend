import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import { parseInput } from "../../shared/application/validation.js";
import { hasLeftFoundation } from "../../administrative/domain/child.entity.js";
import type { ChildReader } from "../../administrative/domain/child.reader.js";
import type {
  RegisterAttendanceInput,
  UpdateAttendanceInput,
  WorkshopAttendance,
} from "../domain/workshop-attendance.entity.js";
import { ensureCanTakeAttendance } from "../domain/attendance.rules.js";
import type { Workshop } from "../domain/workshop.entity.js";
import type { WorkshopRepository } from "../domain/workshop.repository.js";
import type { WorkshopAttendanceRepository } from "../domain/workshop-attendance.repository.js";
import type { WorkshopSession } from "../domain/workshop-session.entity.js";
import type { WorkshopSessionRepository } from "../domain/workshop-session.repository.js";
import { registerAttendanceSchema, updateAttendanceSchema } from "./attendance.schemas.js";

/**
 * Asistencia de estudiantes a las sesiones de un taller (§3.8 y §3.13, ADR-009).
 * Se toma con la sesión en curso; no recalcula calificaciones: las evaluaciones
 * cuentan al finalizar la sesión.
 */
export class AttendanceService {
  constructor(
    private readonly attendances: WorkshopAttendanceRepository,
    private readonly workshops: WorkshopRepository,
    private readonly sessions: WorkshopSessionRepository,
    private readonly children: ChildReader,
  ) {}

  async get(id: bigint): Promise<WorkshopAttendance> {
    const attendance = await this.attendances.findById(id);
    if (!attendance) throw new NotFoundError("Asistencia", id);
    return attendance;
  }

  /** Quiénes asistieron a un taller (todas sus sesiones). */
  async listByWorkshop(workshopId: bigint): Promise<WorkshopAttendance[]> {
    await this.getWorkshop(workshopId);
    return this.attendances.findByWorkshop(workshopId);
  }

  /** Quiénes asistieron a una sesión. */
  async listBySession(sessionId: bigint): Promise<WorkshopAttendance[]> {
    await this.getSession(sessionId);
    return this.attendances.findBySession(sessionId);
  }

  /** A qué sesiones y talleres asistió un estudiante. */
  async listByStudent(studentId: bigint): Promise<WorkshopAttendance[]> {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
    return this.attendances.findByStudent(studentId);
  }

  /**
   * Registra la asistencia a una sesión en curso: estudiante activo y una sola
   * por estudiante y sesión. El taller y la fecha son los de la sesión.
   */
  async register(data: RegisterAttendanceInput, actor: ActorId): Promise<WorkshopAttendance> {
    const parsed = parseInput(registerAttendanceSchema, data, "Asistencia");
    const session = await this.getSession(parsed.sessionId);
    ensureCanTakeAttendance(await this.getWorkshop(session.workshopId), session);

    const child = await this.children.findById(parsed.studentId);
    if (!child) throw new NotFoundError("Estudiante", parsed.studentId);
    if (hasLeftFoundation(child)) {
      throw new ValidationError("El estudiante ya salió de la fundación: no se le puede registrar asistencia");
    }
    if (await this.attendances.findInSession(session.id, parsed.studentId)) {
      throw new ConflictError("El estudiante ya tiene asistencia en esta sesión");
    }
    return this.attendances.create(
      { ...parsed, workshopId: session.workshopId, attendedAt: session.startsAt },
      actor,
    );
  }

  /** Solo se corrige la observación (también con la sesión finalizada). */
  async update(id: bigint, data: UpdateAttendanceInput, actor: ActorId): Promise<WorkshopAttendance> {
    const parsed = parseInput(updateAttendanceSchema, data, "Asistencia");
    await this.get(id);
    return this.attendances.update(id, parsed, actor);
  }

  /** Solo con la sesión en curso: después es historial. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    const current = await this.get(id);
    const session = await this.getSession(current.sessionId);
    ensureCanTakeAttendance(await this.getWorkshop(session.workshopId), session);
    await this.attendances.delete(id, actor);
  }

  private async getWorkshop(workshopId: bigint): Promise<Workshop> {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) throw new NotFoundError("Taller", workshopId);
    return workshop;
  }

  private async getSession(sessionId: bigint): Promise<WorkshopSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError("Sesión", sessionId);
    return session;
  }
}
