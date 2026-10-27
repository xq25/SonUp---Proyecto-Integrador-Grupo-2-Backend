import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  CreateEvaluationScaleInput,
  EvaluateSkillInput,
  EvaluationScale,
  EvaluationSkill,
  UpdateEvaluationScaleInput,
} from "./evaluation.entity.js";

/** Estudiante y habilidad cuya calificación depende de una evaluación. */
export interface StudentSkillPair {
  studentId: bigint;
  skillId: bigint;
}

export interface EvaluationScaleRepository {
  findById(id: bigint): Promise<EvaluationScale | null>;
  /** Incluye eliminadas: el código es único en toda la tabla. */
  findByCode(code: string): Promise<EvaluationScale | null>;
  /** Sin distinguir mayúsculas. Incluye eliminadas: el nombre es único en toda la tabla. */
  findByName(name: string): Promise<EvaluationScale | null>;
  /** ¿Se usó en evaluaciones o calificaciones de estudiantes vigentes? */
  isInUse(id: bigint): Promise<boolean>;
  /** Ordenadas por `numValue`. */
  findAll(activeOnly?: boolean): Promise<EvaluationScale[]>;
  /** Escala activa cuyo intervalo [minValue, maxValue] contiene el valor. */
  findByValue(value: number): Promise<EvaluationScale | null>;
  /** Escalas activas cuyo intervalo se solapa con [minValue, maxValue]. */
  findOverlapping(minValue: number, maxValue: number, excludeId?: bigint): Promise<EvaluationScale[]>;
  create(data: CreateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale>;
  update(id: bigint, data: UpdateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}

export interface EvaluationSkillRepository {
  /** Evaluación vigente de esa habilidad en esa asistencia. */
  find(workshopAttendanceId: bigint, workshopSkillId: bigint): Promise<EvaluationSkill | null>;
  findByAttendance(workshopAttendanceId: bigint): Promise<EvaluationSkill[]>;
  /**
   * `numValue` de las escalas con que se calificó una habilidad a un estudiante
   * en sus talleres, en orden cronológico (fecha de asistencia). Solo considera
   * evaluaciones, asistencias y habilidades de taller vigentes.
   */
  findGradeHistory(studentId: bigint, skillId: bigint): Promise<number[]>;
  /** Pares estudiante–habilidad evaluados en una asistencia (aunque la asistencia esté eliminada). */
  findGradedPairsByAttendance(workshopAttendanceId: bigint): Promise<StudentSkillPair[]>;
  /** Pares estudiante–habilidad evaluados con una habilidad de taller (aunque esté eliminada). */
  findGradedPairsByWorkshopSkill(workshopSkillId: bigint): Promise<StudentSkillPair[]>;
  /** Crea, cambia la escala o restaura la evaluación (única por asistencia y habilidad). */
  upsert(data: EvaluateSkillInput, actor: ActorId): Promise<EvaluationSkill>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
