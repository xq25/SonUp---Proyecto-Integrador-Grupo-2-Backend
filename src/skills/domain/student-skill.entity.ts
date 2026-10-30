import type { AuditableEntity } from "../../shared/domain/auditable.js";

/**
 * Calificación de una habilidad en un estudiante, expresada como una escala
 * (diagrama: StudentSkills, relación RATTED_ON). `studentId` es el `child_id`
 * del módulo administrativo.
 *
 * No se asigna a mano: la calcula GradingService a partir de las
 * evaluaciones del estudiante en talleres ((anterior + nueva) / 2).
 */
export interface StudentSkill extends AuditableEntity {
  id: bigint;
  studentId: bigint;
  skillId: bigint;
  evaluationScaleId: bigint;
}

export interface SetStudentSkillInput {
  studentId: bigint;
  skillId: bigint;
  evaluationScaleId: bigint;
}

/** Calificación vigente de una habilidad del estudiante, con su categoría y valor numérico. */
export interface StudentSkillGrade {
  skillId: bigint;
  skillCategoryId: bigint;
  categoryName: string;
  numValue: number;
}

/** Promedio de las calificaciones de un estudiante en las habilidades de una categoría. */
export interface CategoryAverage {
  skillCategoryId: bigint;
  categoryName: string;
  /** Habilidades calificadas que entran en el promedio. */
  skillCount: number;
  average: number;
  /** Escala en la que cae el promedio (null si cae en un hueco entre escalas). */
  evaluationScaleId: bigint | null;
}
