import type { AuditableEntity } from "../../shared/domain/auditable.js";

/**
 * Evaluación de una habilidad del taller (`workshopSkillId`) para una
 * asistencia concreta de un estudiante (`workshopAttendanceId`).
 */
export interface EvaluationSkill extends AuditableEntity {
  id: bigint;
  workshopAttendanceId: bigint;
  workshopSkillId: bigint;
  evaluationScaleId: bigint;
}

export interface EvaluateSkillInput {
  workshopAttendanceId: bigint;
  workshopSkillId: bigint;
  evaluationScaleId: bigint;
}

/** Estudiante y habilidad cuya calificación depende de una evaluación. */
export interface StudentSkillPair {
  studentId: bigint;
  skillId: bigint;
}

/**
 * Valoración de una sesión finalizada con su habilidad y su fecha: permite
 * reconstruir cómo fue cambiando la calificación del estudiante en el tiempo.
 */
export interface GradeTimelineEntry {
  skillId: bigint;
  skillName: string;
  skillCategoryId: bigint;
  categoryName: string;
  /** `numValue` de la escala con que se valoró. */
  numValue: number;
  /** Inicio de la sesión: da el orden y el mes de la valoración. */
  sessionStartsAt: Date;
}
