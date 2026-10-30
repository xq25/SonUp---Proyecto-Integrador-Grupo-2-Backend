import type { ActorId } from "../../shared/domain/auditable.js";
import type { CreateWorkshopInput, UpdateWorkshopInput, Workshop, WorkshopFilter } from "./workshop.entity.js";

export interface WorkshopRepository {
  findById(id: bigint): Promise<Workshop | null>;
  findMany(filter?: WorkshopFilter): Promise<Workshop[]>;
  /** ¿Tiene asistencias vigentes? */
  hasAttendances(id: bigint): Promise<boolean>;
  /** Fecha de la última asistencia vigente del taller, o null si no tiene. */
  findLastAttendedAt(id: bigint): Promise<Date | null>;
  create(data: CreateWorkshopInput, actor: ActorId): Promise<Workshop>;
  update(id: bigint, data: UpdateWorkshopInput, actor: ActorId): Promise<Workshop>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
