import { NotFoundError } from "../../shared/domain/errors.js";
import type { ChildGuardianWithChild } from "../domain/child-guardian.entity.js";
import type { ChildGuardianReader } from "../domain/child-guardian.reader.js";
import type { Guardian, GuardianFilter } from "../domain/guardian.entity.js";
import type { GuardianReader } from "../domain/guardian.reader.js";

/** Consulta de acudientes del módulo administrativo (solo lectura). */
export class GuardiansService {
  constructor(
    private readonly guardians: GuardianReader,
    private readonly childGuardians: ChildGuardianReader,
  ) {}

  async get(id: bigint): Promise<Guardian> {
    const guardian = await this.guardians.findById(id);
    if (!guardian) throw new NotFoundError("Acudiente", id);
    return guardian;
  }

  list(filter?: GuardianFilter): Promise<Guardian[]> {
    return this.guardians.findMany(filter);
  }

  async getChildren(guardianId: bigint, activeOnly = true): Promise<ChildGuardianWithChild[]> {
    await this.get(guardianId);
    return this.childGuardians.findByGuardian(guardianId, activeOnly);
  }
}
