import type { AuditableEntity, QueryOptions } from "../../shared/domain/auditable.js";

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
