import { ValidationError } from "../../shared/domain/errors.js";

// Reglas de calificación (funciones puras, sin acceso a datos).

/** Rango global de calificación. También es un check en la BD. */
export const GRADE_MIN = 0;
export const GRADE_MAX = 5;

/** Lo mínimo de una escala que necesitan los cálculos. */
export interface GradeScale {
  numValue: number;
  minValue: number;
  maxValue: number;
}

/**
 * Redondea a 2 decimales (half-up), como numeric(5,2).
 * Necesario porque (a + b) / 2 con valores de 2 decimales puede dar 3
 * (p. ej. 1.995) y caer entre dos intervalos contiguos (1.99 | 2.00).
 */
export function roundGrade(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Escala cuyo intervalo inclusivo [minValue, maxValue] contiene el valor (redondeado), o null si cae en un hueco. */
export function findScaleForValue<T extends GradeScale>(scales: readonly T[], value: number): T | null {
  const rounded = roundGrade(value);
  return scales.find((s) => s.minValue <= rounded && rounded <= s.maxValue) ?? null;
}

/**
 * Calificación acumulada de una habilidad en un estudiante.
 *
 * Recorre las calificaciones de los talleres en orden cronológico:
 * - La primera se clasifica tal cual.
 * - Cada una de las siguientes se promedia con la calificación anterior,
 *   `(anterior.numValue + nueva) / 2`, se redondea a 2 decimales y se clasifica.
 *
 * Devuelve null si no hay calificaciones.
 * Lanza ValidationError si algún valor cae fuera de todas las escalas.
 */
export function accumulateSkillGrade<T extends GradeScale>(grades: readonly number[], scales: readonly T[]): T | null {
  let current: T | null = null;
  for (const grade of grades) {
    const value: number = roundGrade(current === null ? grade : (current.numValue + grade) / 2);
    current = findScaleForValue(scales, value);
    if (!current) {
      throw new ValidationError(`La calificación ${value} no cae en ninguna escala activa`);
    }
  }
  return current;
}

/** Promedio simple redondeado a 2 decimales (escala numeric(5,2)). */
export function average(values: readonly number[]): number {
  if (values.length === 0) throw new ValidationError("No hay valores para promediar");
  return roundGrade(values.reduce((acc, v) => acc + v, 0) / values.length);
}

/** Tramo del rango global que ninguna escala cubre (inclusivo, en pasos de 0.01). */
export interface CoverageGap {
  from: number;
  to: number;
}

/**
 * Huecos del rango global [GRADE_MIN, GRADE_MAX] que no cubre ninguna escala.
 * Un promedio que caiga en un hueco no se puede clasificar.
 */
export function findCoverageGaps(scales: readonly GradeScale[]): CoverageGap[] {
  const sorted = [...scales].sort((a, b) => a.minValue - b.minValue);
  const gaps: CoverageGap[] = [];
  let next = GRADE_MIN; // primer valor aún no cubierto
  for (const scale of sorted) {
    if (scale.minValue > next) gaps.push({ from: next, to: roundGrade(scale.minValue - 0.01) });
    next = Math.max(next, roundGrade(scale.maxValue + 0.01));
  }
  if (next <= GRADE_MAX) gaps.push({ from: next, to: GRADE_MAX });
  return gaps;
}

/** Valida los valores de una escala: rango global y `min ≤ num ≤ max`. */
export function ensureValidScaleValues(numValue: number, minValue: number, maxValue: number): void {
  for (const [label, value] of [["valor", numValue], ["mínimo", minValue], ["máximo", maxValue]] as const) {
    if (value < GRADE_MIN || value > GRADE_MAX) {
      throw new ValidationError(`El ${label} de la escala debe estar entre ${GRADE_MIN} y ${GRADE_MAX}`);
    }
  }
  if (minValue > maxValue) {
    throw new ValidationError("El valor mínimo no puede ser mayor que el máximo");
  }
  if (numValue < minValue || numValue > maxValue) {
    throw new ValidationError("El valor de la escala debe estar dentro de su intervalo [mínimo, máximo]");
  }
}
