import type { ActorId } from "../../shared/domain/auditable.js";
import type { StudentSkill } from "../../skills/domain/student-skill.entity.js";

/**
 * Puerto para recalcular las calificaciones (`student_skills`). Solo cuentan
 * las evaluaciones de sesiones finalizadas (ADR-009), así que se recalcula al
 * finalizar una sesión y a mano. Lo usa el servicio de sesiones sin depender
 * de su implementación.
 */
export interface SkillGradeRecalculator {
  /** Recalcula la calificación de una habilidad en un estudiante desde su historial. */
  recalculate(studentId: bigint, skillId: bigint, actor: ActorId): Promise<StudentSkill | null>;
  /** Carga a las calificaciones las evaluaciones de una sesión (al finalizarla). */
  recalculateForSession(workshopSessionId: bigint, actor: ActorId): Promise<void>;
}
