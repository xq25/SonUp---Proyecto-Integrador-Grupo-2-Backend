import { Router } from "express";
import type { AppsService } from "../application/apps.service.js";
import type { RolesService } from "../application/roles.service.js";
import type { UserRolesService } from "../application/user-roles.service.js";
import { createAppsRouter } from "./apps.routes.js";
import { createRolesRouter } from "./roles.routes.js";
import { createUserRolesRouter } from "./user-roles.routes.js";

/** Catálogo de rutas del módulo: aplicaciones, roles y roles de usuario. */
export function createAccessCatalog(services: {
  apps: AppsService;
  roles: RolesService;
  userRoles: UserRolesService;
}): Router {
  const router = Router();
  router.use(createAppsRouter(services));
  router.use(createRolesRouter(services));
  router.use(createUserRolesRouter(services));
  return router;
}
