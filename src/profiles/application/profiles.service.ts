import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError } from "../../shared/domain/errors.js";
import type { Profile, ProfileFilter, UpdateProfileInput } from "../domain/profile.entity.js";
import type { ProfileRepository } from "../domain/profile.repository.js";
import { updateProfileSchema } from "./profile.schemas.js";

export class ProfilesService {
  constructor(private readonly profiles: ProfileRepository) {}

  async get(id: string): Promise<Profile> {
    const profile = await this.profiles.findById(id);
    if (!profile) throw new NotFoundError("Perfil", id);
    return profile;
  }

  list(filter?: ProfileFilter): Promise<Profile[]> {
    return this.profiles.findMany(filter);
  }

  async update(id: string, data: UpdateProfileInput, actor: ActorId): Promise<Profile> {
    const input = parseInput(updateProfileSchema, data, "Perfil");
    await this.get(id);
    if (input.documentNumber) {
      await this.ensureDocumentAvailable(input.documentNumber, id);
    }
    return this.profiles.update(id, input, actor);
  }

  async delete(id: string, actor: ActorId): Promise<void> {
    await this.get(id);
    await this.profiles.delete(id, actor);
  }

  async restore(id: string, actor: ActorId): Promise<Profile> {
    const profile = await this.profiles.findById(id, { includeDeleted: true });
    if (!profile) throw new NotFoundError("Perfil", id);
    if (!profile.deletedAt) return profile;
    return this.profiles.restore(id, actor);
  }

  private async ensureDocumentAvailable(documentNumber: string, excludeId: string) {
    const existing = await this.profiles.findByDocumentNumber(documentNumber);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe un perfil con el documento "${documentNumber}"`);
    }
  }
}
