import { NotFoundError } from "../../shared/domain/errors.js";
import type { Child, ChildFilter } from "../domain/child.entity.js";
import type { ChildReader } from "../domain/child.reader.js";
import type { ChildGuardianWithGuardian } from "../domain/child-guardian.entity.js";
import type { ChildGuardianReader } from "../domain/child-guardian.reader.js";

/** Consulta de jóvenes del módulo administrativo (solo lectura). */
export class ChildrenService {
  constructor(
    private readonly children: ChildReader,
    private readonly childGuardians: ChildGuardianReader,
  ) {}

  async get(id: bigint): Promise<Child> {
    const child = await this.children.findById(id);
    if (!child) throw new NotFoundError("Joven", id);
    return child;
  }

  findByDocument(documentNumber: string): Promise<Child | null> {
    return this.children.findByDocumentNumber(documentNumber);
  }

  list(filter?: ChildFilter): Promise<Child[]> {
    return this.children.findMany(filter);
  }

  async getGuardians(childId: bigint, activeOnly = true): Promise<ChildGuardianWithGuardian[]> {
    await this.get(childId);
    return this.childGuardians.findByChild(childId, activeOnly);
  }
}
