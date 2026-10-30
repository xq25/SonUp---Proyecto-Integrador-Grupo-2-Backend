import type { AuditableEntity } from "../../shared/domain/auditable.js";

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
