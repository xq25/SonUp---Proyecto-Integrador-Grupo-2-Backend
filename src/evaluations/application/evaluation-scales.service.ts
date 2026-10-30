import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type {
  CreateEvaluationScaleInput,
  EvaluationScale,
  UpdateEvaluationScaleInput,
} from "../domain/evaluation-scale.entity.js";
import type { EvaluationScaleRepository } from "../domain/evaluation-scale.repository.js";
import { type CoverageGap, ensureValidScaleValues, findCoverageGaps, roundGrade } from "../domain/grading.js";
import { createEvaluationScaleSchema, updateEvaluationScaleSchema } from "./evaluation-scale.schemas.js";

/** Escalas de calificación (docs/VALIDACIONES.md §3.4). */
export class EvaluationScalesService {
  constructor(private readonly scales: EvaluationScaleRepository) {}

  list(activeOnly = true): Promise<EvaluationScale[]> {
    return this.scales.findAll(activeOnly);
  }

  async get(id: bigint): Promise<EvaluationScale> {
    const scale = await this.scales.findById(id);
    if (!scale) throw new NotFoundError("Escala de evaluación", id);
    return scale;
  }

  async create(data: CreateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale> {
    const input = parseInput(createEvaluationScaleSchema, data, "Escala de evaluación");
    await this.ensureCodeAvailable(input.code);
    await this.ensureNameAvailable(input.name);
    ensureValidScaleValues(input.numValue, input.minValue, input.maxValue);
    if (input.isActive ?? true) await this.ensureNoOverlap(input.minValue, input.maxValue);
    return this.scales.create(input, actor);
  }

  /**
   * Si la escala ya se usó en evaluaciones o calificaciones, solo se pueden
   * cambiar el nombre, la descripción y si está activa: el código y los valores
   * quedan fijos para que las calificaciones históricas no cambien.
   */
  async update(id: bigint, data: UpdateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale> {
    const input = parseInput(updateEvaluationScaleSchema, data, "Escala de evaluación");
    const current = await this.get(id);

    const locked = (["code", "numValue", "minValue", "maxValue"] as const).filter(
      (field) => input[field] !== undefined && input[field] !== current[field],
    );
    if (locked.length > 0 && (await this.scales.isInUse(id))) {
      throw new ConflictError(
        `La escala ya se usó en calificaciones: no se puede cambiar ${locked.join(", ")} (solo nombre, descripción o estado)`,
      );
    }

    if (input.code) await this.ensureCodeAvailable(input.code, id);
    if (input.name) await this.ensureNameAvailable(input.name, id);
    // Se valida el resultado final: los valores nuevos combinados con los actuales.
    const minValue = input.minValue ?? current.minValue;
    const maxValue = input.maxValue ?? current.maxValue;
    ensureValidScaleValues(input.numValue ?? current.numValue, minValue, maxValue);
    if (input.isActive ?? current.isActive) await this.ensureNoOverlap(minValue, maxValue, id);
    return this.scales.update(id, input, actor);
  }

  /** Escala en la que se clasifica un valor (p. ej. un promedio de calificaciones), redondeado a 2 decimales. */
  async classify(value: number): Promise<EvaluationScale> {
    const rounded = roundGrade(value);
    const scale = await this.scales.findByValue(rounded);
    if (!scale) throw new ValidationError(`Ninguna escala activa contiene el valor ${rounded}`);
    return scale;
  }

  /** Tramos del rango 0–5 que ninguna escala activa cubre: un promedio ahí no se puede clasificar. */
  async getCoverageGaps(): Promise<CoverageGap[]> {
    return findCoverageGaps(await this.scales.findAll(true));
  }

  /** Solo se elimina si nunca se usó; si se usó, se debe inactivar. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    if (await this.scales.isInUse(id)) {
      throw new ConflictError("La escala ya se usó en calificaciones: inactívela en lugar de eliminarla");
    }
    await this.scales.delete(id, actor);
  }

  private async ensureCodeAvailable(code: string, excludeId?: bigint) {
    const existing = await this.scales.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una escala con el código "${code}"`);
    }
  }

  private async ensureNameAvailable(name: string, excludeId?: bigint) {
    const existing = await this.scales.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una escala llamada "${name}"`);
    }
  }

  /** Los intervalos de escalas activas no se pueden solapar: cada promedio cae en una sola escala. */
  private async ensureNoOverlap(minValue: number, maxValue: number, excludeId?: bigint) {
    const overlapping = await this.scales.findOverlapping(minValue, maxValue, excludeId);
    if (overlapping.length > 0) {
      const names = overlapping.map((s) => `"${s.name}" [${s.minValue}, ${s.maxValue}]`).join(", ");
      throw new ConflictError(`El intervalo [${minValue}, ${maxValue}] se solapa con: ${names}`);
    }
  }
}
