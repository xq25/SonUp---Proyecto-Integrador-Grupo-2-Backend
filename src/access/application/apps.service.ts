import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError } from "../../shared/domain/errors.js";
import type { App, CreateAppInput } from "../domain/app.entity.js";
import type { AppRepository } from "../domain/app.repository.js";
import { createAppSchema } from "./app.schemas.js";

/** Catálogo de aplicaciones del ecosistema. */
export class AppsService {
  constructor(private readonly apps: AppRepository) {}

  list(): Promise<App[]> {
    return this.apps.findAll();
  }

  async create(data: CreateAppInput, actor: ActorId): Promise<App> {
    const input = parseInput(createAppSchema, data, "Aplicación");
    if (await this.apps.findByCode(input.code)) {
      throw new ConflictError(`La aplicación "${input.code}" ya existe`);
    }
    return this.apps.create(input, actor);
  }
}
