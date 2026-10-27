import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  CreateWorkshopInput,
  RegisterAttendanceInput,
  UpdateAttendanceInput,
  UpdateWorkshopInput,
  Workshop,
  WorkshopAttendance,
  WorkshopFilter,
  WorkshopSkill,
} from "./workshop.entity.js";

export interface WorkshopRepository {
  findById(id: bigint): Promise<Workshop | null>;
  findMany(filter?: WorkshopFilter): Promise<Workshop[]>;
  /** ¿Tiene asistencias vigentes? */
  hasAttendances(id: bigint): Promise<boolean>;
  /** Fecha de la última asistencia vigente del taller, o null si no tiene. */
  findLastAttendedAt(id: bigint): Promise<Date | null>;
  create(data: CreateWorkshopInput, actor: ActorId): Promise<Workshop>;
  update(id: bigint, data: UpdateWorkshopInput, actor: ActorId): Promise<Workshop>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}

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
