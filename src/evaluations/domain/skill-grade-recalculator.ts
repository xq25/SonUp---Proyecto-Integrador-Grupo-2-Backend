import type { ActorId } from "../../shared/domain/auditable.js";
import type { StudentSkill } from "../../skills/domain/skill.entity.js";

/**
 * Puerto para recalcular las calificaciones (`student_skills`) cuando cambian
 * los datos de los que dependen: evaluaciones, asistencias o habilidades de un taller.
 * Lo usan los servicios de talleres y asistencias sin depender de su implementación.
 */
export interface SkillGradeRecalculator {
  /** Recalcula la calificación de una habilidad en un estudiante desde su historial. */
  recalculate(studentId: bigint, skillId: bigint, actor: ActorId): Promise<StudentSkill | null>;
  /** Recalcula las habilidades evaluadas en una asistencia (p. ej. tras eliminarla). */
  recalculateForAttendance(workshopAttendanceId: bigint, actor: ActorId): Promise<void>;
  /** Recalcula a los estudiantes evaluados en una habilidad de taller (p. ej. tras quitarla del taller). */
  recalculateForWorkshopSkill(workshopSkillId: bigint, actor: ActorId): Promise<void>;
}
