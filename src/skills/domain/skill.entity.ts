import type { AuditableEntity, QueryOptions } from "../../shared/domain/auditable.js";

export interface SkillCategory extends AuditableEntity {
  id: bigint;
  name: string;
  description: string | null;
}

export interface CreateSkillCategoryInput {
  name: string;
  description?: string | null;
}

export type UpdateSkillCategoryInput = Partial<CreateSkillCategoryInput>;

// Valores definidos por el check de `skills.status` en la BD.
export const SKILL_STATUSES = ["active", "inactive"] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

export interface Skill extends AuditableEntity {
  id: bigint;
  name: string;
  skillCategoryId: bigint;
  status: SkillStatus;
}

export interface CreateSkillInput {
  name: string;
  skillCategoryId: bigint;
  status?: SkillStatus;
}

export type UpdateSkillInput = Partial<CreateSkillInput>;

export interface SkillFilter extends QueryOptions {
  skillCategoryId?: bigint;
  status?: SkillStatus;
  /** Busca en el nombre. */
  search?: string;
}

/**
 * Calificación de una habilidad en un estudiante, expresada como una escala
 * (diagrama: StudentSkills, relación RATTED_ON). `studentId` es el `child_id`
 * del módulo administrativo.
 *
 * No se asigna a mano: la calcula EvaluationsService a partir de las
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
