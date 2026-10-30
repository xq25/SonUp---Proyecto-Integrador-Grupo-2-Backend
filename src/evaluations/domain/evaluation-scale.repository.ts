import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  CreateEvaluationScaleInput,
  EvaluationScale,
  UpdateEvaluationScaleInput,
} from "./evaluation-scale.entity.js";

export interface EvaluationScaleRepository {
  findById(id: bigint): Promise<EvaluationScale | null>;
  /** Incluye eliminadas: el código es único en toda la tabla. */
  findByCode(code: string): Promise<EvaluationScale | null>;
  /** Sin distinguir mayúsculas. Incluye eliminadas: el nombre es único en toda la tabla. */
  findByName(name: string): Promise<EvaluationScale | null>;
  /** ¿Se usó en evaluaciones o calificaciones de estudiantes vigentes? */
  isInUse(id: bigint): Promise<boolean>;
  /** Ordenadas por `numValue`. */
  findAll(activeOnly?: boolean): Promise<EvaluationScale[]>;
  /** Escala activa cuyo intervalo [minValue, maxValue] contiene el valor. */
  findByValue(value: number): Promise<EvaluationScale | null>;
  /** Escalas activas cuyo intervalo se solapa con [minValue, maxValue]. */
  findOverlapping(minValue: number, maxValue: number, excludeId?: bigint): Promise<EvaluationScale[]>;
  create(data: CreateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale>;
  update(id: bigint, data: UpdateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
