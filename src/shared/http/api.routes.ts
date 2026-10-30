import { Router } from "express";
import type { Container } from "../../container.js";
import { createAccessCatalog } from "../../access/http/access.catalog.js";
import { createAdministrativeCatalog } from "../../administrative/http/administrative.catalog.js";
import { createAdministratorsCatalog } from "../../administrators/http/administrators.catalog.js";
import { createAuthCatalog } from "../../auth/http/auth.catalog.js";
import { createEvaluationsCatalog } from "../../evaluations/http/evaluations.catalog.js";
import { createEvidencesCatalog } from "../../evidences/http/evidences.catalog.js";
import { createProfilesCatalog } from "../../profiles/http/profiles.catalog.js";
import { createSkillsCatalog } from "../../skills/http/skills.catalog.js";
import { createWorkshopsCatalog } from "../../workshops/http/workshops.catalog.js";
import { type AuthOptions, authenticate } from "./authenticate.js";

// Directorio general de la API: reúne el catálogo de rutas de cada módulo.

export const API_PREFIX = "/api";

/**
 * Archivos donde swagger-jsdoc busca la documentación (`apis` de swagger.js).
 * Son globs relativos a la raíz del proyecto (desde donde corre `npm run`).
 * Un módulo nuevo queda incluido sin tocar esta lista.
 */
export const API_DOC_FILES = ["./src/*/http/*.routes.ts", "./src/*/http/*.catalog.ts", "./src/docs/**/*.yaml"];

/** Todas las rutas bajo `/api`. Lo que se monta antes de `authenticate` es público. */
export function createApiRouter(container: Container, auth: AuthOptions): Router {
  const api = Router();

  // Rutas públicas: estado y autenticación (ADR-003).
  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  api.use(createAuthCatalog(container));

  api.use(authenticate(container.profiles, auth));
  api.use(createAdministrativeCatalog(container));
  api.use(createAdministratorsCatalog(container));
  api.use(createProfilesCatalog(container));
  api.use(createAccessCatalog(container));
  api.use(createSkillsCatalog(container));
  api.use(createEvaluationsCatalog(container));
  api.use(createWorkshopsCatalog(container));
  api.use(createEvidencesCatalog(container));

  return api;
}
