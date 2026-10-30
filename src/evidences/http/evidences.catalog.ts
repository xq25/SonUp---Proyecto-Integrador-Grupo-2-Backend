import { Router } from "express";
import type { CredentialsService } from "../application/credentials.service.js";
import type { EvidencesService } from "../application/evidences.service.js";
import type { StudentEvidencesService } from "../application/student-evidences.service.js";
import { createCredentialsRouter } from "./credentials.routes.js";
import { createEvidencesRouter } from "./evidences.routes.js";
import { createStudentEvidencesRouter } from "./student-evidences.routes.js";

/** Catálogo de rutas del módulo: evidencias, sus estudiantes y credenciales. */
export function createEvidencesCatalog(services: {
  evidences: EvidencesService;
  studentEvidences: StudentEvidencesService;
  credentials: CredentialsService;
}): Router {
  const router = Router();
  router.use(createEvidencesRouter(services));
  router.use(createStudentEvidencesRouter(services));
  router.use(createCredentialsRouter(services));
  return router;
}
