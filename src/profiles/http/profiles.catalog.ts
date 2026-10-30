import { Router } from "express";
import type { ProfilesService } from "../application/profiles.service.js";
import { createProfilesRouter } from "./profiles.routes.js";

/** Catálogo de rutas del módulo: perfiles. */
export function createProfilesCatalog(services: { profiles: ProfilesService }): Router {
  const router = Router();
  router.use(createProfilesRouter(services));
  return router;
}
