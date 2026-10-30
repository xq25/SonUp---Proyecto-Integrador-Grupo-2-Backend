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
