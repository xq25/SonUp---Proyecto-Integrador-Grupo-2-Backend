import type { ActorId } from "../../shared/domain/auditable.js";
import type { App, CreateAppInput } from "./app.entity.js";

export interface AppRepository {
  findByCode(code: string): Promise<App | null>;
  findAll(): Promise<App[]>;
  create(data: CreateAppInput, actor: ActorId): Promise<App>;
}
