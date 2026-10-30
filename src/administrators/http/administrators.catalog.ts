import { Router } from "express";
import type { AdministratorsService } from "../application/administrators.service.js";
import { createAdministratorsRouter } from "./administrators.routes.js";

/** Catálogo de rutas del módulo: administrativos (tabla provisional). */
export function createAdministratorsCatalog(services: { administrators: AdministratorsService }): Router {
  const router = Router();
  router.use(createAdministratorsRouter(services));
  return router;
}
