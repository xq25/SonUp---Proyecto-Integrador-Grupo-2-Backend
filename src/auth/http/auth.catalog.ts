import { Router } from "express";
import type { AuthService } from "../application/auth.service.js";
import { createAuthRouter } from "./auth.routes.js";

/** Catálogo de rutas del módulo: registro, login y perfil (públicas, ADR-003). */
export function createAuthCatalog(services: { auth: AuthService }): Router {
  const router = Router();
  router.use(createAuthRouter(services));
  return router;
}
