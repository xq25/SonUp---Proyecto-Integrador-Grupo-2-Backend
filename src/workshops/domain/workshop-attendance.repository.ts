import type { ActorId } from "../../shared/domain/auditable.js";
import type { NewAttendance, UpdateAttendanceInput, WorkshopAttendance } from "./workshop-attendance.entity.js";

export interface WorkshopAttendanceRepository {
  findById(id: bigint): Promise<WorkshopAttendance | null>;
  findByWorkshop(workshopId: bigint): Promise<WorkshopAttendance[]>;
  findBySession(sessionId: bigint): Promise<WorkshopAttendance[]>;
  findByStudent(studentId: bigint): Promise<WorkshopAttendance[]>;
  /** ¿El estudiante tiene al menos una asistencia vigente en el taller? */
  hasAttended(workshopId: bigint, studentId: bigint): Promise<boolean>;
  /** Asistencia vigente del estudiante en la sesión (una por estudiante y sesión). */
  findInSession(sessionId: bigint, studentId: bigint): Promise<WorkshopAttendance | null>;
  create(data: NewAttendance, actor: ActorId): Promise<WorkshopAttendance>;
  update(id: bigint, data: UpdateAttendanceInput, actor: ActorId): Promise<WorkshopAttendance>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
