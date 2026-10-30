import type { ActorId } from "../../shared/domain/auditable.js";
import type { SetStudentSkillInput, StudentSkill, StudentSkillGrade } from "./student-skill.entity.js";

export interface StudentSkillRepository {
  /** Registro vigente (no eliminado). */
  find(studentId: bigint, skillId: bigint): Promise<StudentSkill | null>;
  findByStudent(studentId: bigint): Promise<StudentSkill[]>;
  /** Calificaciones vigentes del estudiante con categoría y `numValue` (habilidades y categorías no eliminadas). */
  findGrades(studentId: bigint): Promise<StudentSkillGrade[]>;
  /** Crea, actualiza o restaura el registro (único por estudiante y habilidad). */
  upsert(data: SetStudentSkillInput, actor: ActorId): Promise<StudentSkill>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
