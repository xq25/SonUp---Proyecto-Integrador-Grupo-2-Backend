import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  RegisterAttendanceInput,
  UpdateAttendanceInput,
  WorkshopAttendance,
} from "./workshop-attendance.entity.js";

export interface WorkshopAttendanceRepository {
  findById(id: bigint): Promise<WorkshopAttendance | null>;
  findByWorkshop(workshopId: bigint): Promise<WorkshopAttendance[]>;
  findByStudent(studentId: bigint): Promise<WorkshopAttendance[]>;
  /** ¿El estudiante tiene al menos una asistencia vigente en el taller? */
  hasAttended(workshopId: bigint, studentId: bigint): Promise<boolean>;
  /** Asistencia vigente del estudiante en el taller ese día (fecha YYYY-MM-DD en hora de Bogotá). */
  findOnDay(workshopId: bigint, studentId: bigint, day: string): Promise<WorkshopAttendance | null>;
  create(data: RegisterAttendanceInput, actor: ActorId): Promise<WorkshopAttendance>;
  update(id: bigint, data: UpdateAttendanceInput, actor: ActorId): Promise<WorkshopAttendance>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
