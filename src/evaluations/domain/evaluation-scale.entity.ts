import type { AuditableEntity } from "../../shared/domain/auditable.js";

/**
 * Escala de calificación (p. ej. "en proceso", "logrado").
 * - `numValue`: valor numérico de la calificación; define el orden de las
 *   escalas y es el valor que se promedia.
 * - `minValue` / `maxValue`: intervalo inclusivo de promedios que se
 *   clasifican en esta escala. Los intervalos de escalas activas no se solapan.
 */
export interface EvaluationScale extends AuditableEntity {
  id: bigint;
  code: string;
  name: string;
  description: string | null;
  numValue: number;
  minValue: number;
  maxValue: number;
  isActive: boolean;
}

export interface CreateEvaluationScaleInput {
  code: string;
  name: string;
  description?: string | null;
  numValue: number;
  minValue: number;
  maxValue: number;
  isActive?: boolean;
}

export type UpdateEvaluationScaleInput = Partial<CreateEvaluationScaleInput>;
