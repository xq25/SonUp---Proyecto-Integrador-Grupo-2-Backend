import type { ActorId } from "../../shared/domain/auditable.js";
import { dayInAppTimeZone } from "../../shared/domain/dates.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import { parseInput } from "../../shared/application/validation.js";
import { hasLeftFoundation } from "../../administrative/domain/child.entity.js";
import type { ChildReader } from "../../administrative/domain/child.reader.js";
import type { SkillGradeRecalculator } from "../../evaluations/domain/skill-grade-recalculator.js";
import type {
  RegisterAttendanceInput,
  UpdateAttendanceInput,
  WorkshopAttendance,
} from "../domain/workshop-attendance.entity.js";
import {
  ensureAttendanceDeletable,
  ensureAttendanceEditable,
  ensureCanRegisterAttendance,
  ensureValidAttendanceDate,
} from "../domain/attendance.rules.js";
import type { WorkshopRepository } from "../domain/workshop.repository.js";
import type { WorkshopAttendanceRepository } from "../domain/workshop-attendance.repository.js";
import { registerAttendanceSchema, updateAttendanceSchema } from "./attendance.schemas.js";

/** Asistencia de estudiantes a talleres. */
export class AttendanceService {
  constructor(
    private readonly attendances: WorkshopAttendanceRepository,
    private readonly workshops: WorkshopRepository,
    private readonly children: ChildReader,
    private readonly grades: SkillGradeRecalculator,
  ) {}

  async get(id: bigint): Promise<WorkshopAttendance> {
    const attendance = await this.attendances.findById(id);
    if (!attendance) throw new NotFoundError("Asistencia", id);
    return attendance;
  }

  /** Quiénes asistieron a un taller. */
  async listByWorkshop(workshopId: bigint): Promise<WorkshopAttendance[]> {
    if (!(await this.workshops.findById(workshopId))) throw new NotFoundError("Taller", workshopId);
    return this.attendances.findByWorkshop(workshopId);
  }

  /** A qué talleres asistió un estudiante. */
  async listByStudent(studentId: bigint): Promise<WorkshopAttendance[]> {
    await this.ensureStudentExists(studentId);
    return this.attendances.findByStudent(studentId);
  }

  /**
   * Registra una asistencia (§3.8): estudiante activo, taller `active`, fecha no
   * futura y dentro de las fechas del taller, y una sola por estudiante, taller y día.
   */
  async register(data: RegisterAttendanceInput, actor: ActorId): Promise<WorkshopAttendance> {
    const parsed = parseInput(registerAttendanceSchema, data, "Asistencia");
    const child = await this.children.findById(parsed.studentId);
    if (!child) throw new NotFoundError("Estudiante", parsed.studentId);
    if (hasLeftFoundation(child)) {
      throw new ValidationError("El estudiante ya salió de la fundación: no se le puede registrar asistencia");
    }
    const workshop = await this.getWorkshop(parsed.workshopId);
    ensureCanRegisterAttendance(workshop);

    const attendedAt = parsed.attendedAt ?? new Date();
    ensureValidAttendanceDate(workshop, attendedAt);
    await this.ensureOnePerDay(workshop.id, parsed.studentId, attendedAt);

    return this.attendances.create({ ...parsed, attendedAt }, actor);
  }

  /**
   * Con el taller cerrado (`finished`/`cancelled`) solo se corrige la observación.
   * Si cambia la fecha se revalidan las reglas y se recalculan las calificaciones,
   * porque el orden cronológico de las evaluaciones puede cambiar.
   */
  async update(id: bigint, data: UpdateAttendanceInput, actor: ActorId): Promise<WorkshopAttendance> {
    const parsed = parseInput(updateAttendanceSchema, data, "Asistencia");
    const current = await this.get(id);
    const workshop = await this.getWorkshop(current.workshopId);
    ensureAttendanceEditable(workshop, current, parsed);

    const input: UpdateAttendanceInput = {};
    if (parsed.observation !== undefined) input.observation = parsed.observation;

    const dateChanged =
      parsed.attendedAt !== undefined && parsed.attendedAt.getTime() !== current.attendedAt.getTime();
    if (dateChanged && parsed.attendedAt) {
      ensureValidAttendanceDate(workshop, parsed.attendedAt);
      await this.ensureOnePerDay(workshop.id, current.studentId, parsed.attendedAt, id);
      input.attendedAt = parsed.attendedAt;
    }

    const updated = await this.attendances.update(id, input, actor);
    if (dateChanged) await this.grades.recalculateForAttendance(id, actor);
    return updated;
  }

  /** Elimina la asistencia (no si el taller está cerrado) y recalcula las calificaciones afectadas. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    const current = await this.get(id);
    ensureAttendanceDeletable(await this.getWorkshop(current.workshopId));
    await this.attendances.delete(id, actor);
    await this.grades.recalculateForAttendance(id, actor);
  }

  private async getWorkshop(workshopId: bigint) {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) throw new NotFoundError("Taller", workshopId);
    return workshop;
  }

  /** Una asistencia por estudiante, taller y día (hora de Bogotá). */
  private async ensureOnePerDay(workshopId: bigint, studentId: bigint, attendedAt: Date, excludeId?: bigint) {
    const day = dayInAppTimeZone(attendedAt);
    const existing = await this.attendances.findOnDay(workshopId, studentId, day);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`El estudiante ya tiene asistencia en este taller el ${day}`);
    }
  }

  private async ensureStudentExists(studentId: bigint) {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
  }
}
