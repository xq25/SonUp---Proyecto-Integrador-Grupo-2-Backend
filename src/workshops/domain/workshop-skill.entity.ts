import type { AuditableEntity } from "../../shared/domain/auditable.js";

/** Habilidad que se trabaja en un taller. */
export interface WorkshopSkill extends AuditableEntity {
  id: bigint;
  workshopId: bigint;
  skillId: bigint;
}
