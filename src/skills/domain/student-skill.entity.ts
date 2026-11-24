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

/** Escala de una calificación, para mostrarla sin consultar el catálogo de escalas. */
export interface GradeScaleSummary {
  id: bigint;
  code: string;
  name: string;
  numValue: number;
}

/**
 * Calificación con los nombres de su habilidad, su categoría y su escala: lo que
 * muestra el front. Así el estudiante y el acudiente ven sus habilidades sin
 * leer el árbol completo de habilidades.
 */
export interface StudentSkillDetail extends StudentSkill {
  skillName: string;
  skillCategoryId: bigint;
  categoryName: string;
  scale: GradeScaleSummary;
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
  /** Esa misma escala con su código, nombre y valor (null si cae en un hueco). */
  scale: GradeScaleSummary | null;
}

/** Rango de meses (YYYY-MM, hora de Bogotá) del progreso. Por defecto: desde el mes de la primera valoración hasta el mes actual. */
export interface StudentProgressQuery {
  from?: string;
  to?: string;
}

/** Calificación acumulada de una habilidad al cierre de un mes. */
export interface MonthlySkillGrade {
  skillId: bigint;
  skillName: string;
  skillCategoryId: bigint;
  categoryName: string;
  /** `numValue` de la escala acumulada. */
  value: number;
  scale: GradeScaleSummary;
}

/** Promedio acumulado de un área al cierre de un mes. */
export interface MonthlyAverage {
  skillCount: number;
  average: number;
  /** Escala en la que cae el promedio (null si cae en un hueco entre escalas). */
  scale: GradeScaleSummary | null;
}

export interface MonthlyCategoryAverage extends MonthlyAverage {
  skillCategoryId: bigint;
  categoryName: string;
}

/**
 * Progreso de un mes: la calificación acumulada de cada habilidad al cierre del
 * mes (con la misma fórmula de siempre) y sus promedios. `partial` marca el mes en
 * curso: muestra lo acumulado hasta hoy.
 */
export interface MonthlyProgress {
  month: string;
  partial: boolean;
  /** Valoraciones de sesiones finalizadas que se sumaron en el mes. */
  evaluationCount: number;
  skills: MonthlySkillGrade[];
  categories: MonthlyCategoryAverage[];
  /** Promedio de todas las habilidades calificadas (null si aún no tiene ninguna). */
  overall: MonthlyAverage | null;
}

export interface StudentProgress {
  studentId: bigint;
  from: string;
  to: string;
  months: MonthlyProgress[];
}
