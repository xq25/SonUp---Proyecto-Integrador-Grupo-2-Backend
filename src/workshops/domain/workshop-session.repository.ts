import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  CreateWorkshopSessionInput,
  WorkshopSession,
  WorkshopSessionChanges,
} from "./workshop-session.entity.js";

export interface WorkshopSessionRepository {
  findById(id: bigint): Promise<WorkshopSession | null>;
  /** Sesiones vigentes del taller, ordenadas por inicio. */
  findByWorkshop(workshopId: bigint): Promise<WorkshopSession[]>;
  /** Toda sesión nace `planned`. */
  create(workshopId: bigint, data: CreateWorkshopSessionInput, actor: ActorId): Promise<WorkshopSession>;
  update(id: bigint, data: WorkshopSessionChanges, actor: ActorId): Promise<WorkshopSession>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
