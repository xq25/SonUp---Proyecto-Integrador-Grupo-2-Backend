import type { ActorId } from "../../shared/domain/auditable.js";
import type { EvaluateSkillInput, EvaluationSkill, StudentSkillPair } from "./evaluation-skill.entity.js";

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
