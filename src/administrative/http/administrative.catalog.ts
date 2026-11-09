import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import type { ChildrenService } from "../application/children.service.js";
import type { GuardiansService } from "../application/guardians.service.js";
import type { ProfessionalsService } from "../application/professionals.service.js";
import type { StaffService } from "../application/staff.service.js";
import { createChildrenRouter } from "./children.routes.js";
import { createGuardiansRouter } from "./guardians.routes.js";
import { createProfessionalsRouter } from "./professionals.routes.js";
import { createStaffRouter } from "./staff.routes.js";

/** Catálogo de rutas del módulo: estudiantes, acudientes, talleristas y personal (solo lectura). */
export function createAdministrativeCatalog(services: {
  access: AccessPolicy;
  children: ChildrenService;
  guardians: GuardiansService;
  professionals: ProfessionalsService;
  staff: StaffService;
}): Router {
  const router = Router();
  router.use(createChildrenRouter(services));
  router.use(createGuardiansRouter(services));
  router.use(createProfessionalsRouter(services));
  router.use(createStaffRouter(services));
  return router;
}
