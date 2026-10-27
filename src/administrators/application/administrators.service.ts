import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import { parseInput } from "../../shared/application/validation.js";
import type {
  Administrator,
  AdministratorFilter,
  CreateAdministratorInput,
  UpdateAdministratorInput,
} from "../domain/administrator.entity.js";
import type { AdministratorRepository } from "../domain/administrator.repository.js";
import { createAdministratorSchema, updateAdministratorSchema } from "./administrator.schemas.js";

export class AdministratorsService {
  constructor(private readonly administrators: AdministratorRepository) {}

  async get(id: bigint): Promise<Administrator> {
    const administrator = await this.administrators.findById(id);
    if (!administrator) throw new NotFoundError("Administrativo", id);
    return administrator;
  }

  list(filter?: AdministratorFilter): Promise<Administrator[]> {
    return this.administrators.findMany(filter);
  }

  async create(data: CreateAdministratorInput, actor: ActorId): Promise<Administrator> {
    const input = parseInput(createAdministratorSchema, data, "Administrativo");
    await this.ensureDocumentAvailable(input.documentNumber);
    await this.ensureEmailAvailable(input.email);
    return this.administrators.create(input, actor);
  }

  async update(id: bigint, data: UpdateAdministratorInput, actor: ActorId): Promise<Administrator> {
    const input = parseInput(updateAdministratorSchema, data, "Administrativo");
    await this.get(id);
    if (input.documentNumber) await this.ensureDocumentAvailable(input.documentNumber, id);
    if (input.email) await this.ensureEmailAvailable(input.email, id);
    return this.administrators.update(id, input, actor);
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    await this.administrators.delete(id, actor);
  }

  async restore(id: bigint, actor: ActorId): Promise<Administrator> {
    const administrator = await this.administrators.findById(id, { includeDeleted: true });
    if (!administrator) throw new NotFoundError("Administrativo", id);
    if (!administrator.deletedAt) return administrator;
    return this.administrators.restore(id, actor);
  }

  private async ensureDocumentAvailable(documentNumber: string, excludeId?: bigint) {
    const existing = await this.administrators.findByDocumentNumber(documentNumber);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe un administrativo con el documento "${documentNumber}"`);
    }
  }

  private async ensureEmailAvailable(email: string, excludeId?: bigint) {
    const existing = await this.administrators.findByEmail(email);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe un administrativo con el email "${email}"`);
    }
  }
}
