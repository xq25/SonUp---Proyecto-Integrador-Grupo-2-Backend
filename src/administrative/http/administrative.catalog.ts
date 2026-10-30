import { Router } from "express";
import type { ChildrenService } from "../application/children.service.js";
import type { GuardiansService } from "../application/guardians.service.js";
import type { ProfessionalsService } from "../application/professionals.service.js";
import { createChildrenRouter } from "./children.routes.js";
import { createGuardiansRouter } from "./guardians.routes.js";
import { createProfessionalsRouter } from "./professionals.routes.js";

/** Catálogo de rutas del módulo: estudiantes, acudientes y talleristas (solo lectura). */
export function createAdministrativeCatalog(services: {
  children: ChildrenService;
  guardians: GuardiansService;
  professionals: ProfessionalsService;
}): Router {
  const router = Router();
  router.use(createChildrenRouter(services));
  router.use(createGuardiansRouter(services));
  router.use(createProfessionalsRouter(services));
  return router;
}
