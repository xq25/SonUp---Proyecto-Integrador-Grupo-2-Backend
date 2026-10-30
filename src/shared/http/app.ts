import cors from "cors";
import express, { type Express, Router } from "express";
import type { Container } from "../../container.js";
import { createAppsRouter } from "../../access/http/apps.routes.js";
import { createRolesRouter } from "../../access/http/roles.routes.js";
import { createUserRolesRouter } from "../../access/http/user-roles.routes.js";
import { createChildrenRouter } from "../../administrative/http/children.routes.js";
import { createGuardiansRouter } from "../../administrative/http/guardians.routes.js";
import { createProfessionalsRouter } from "../../administrative/http/professionals.routes.js";
import { createAdministratorsRouter } from "../../administrators/http/administrators.routes.js";
import { createAuthRouter } from "../../auth/http/auth.routes.js";
import { createEvaluationScalesRouter } from "../../evaluations/http/evaluation-scales.routes.js";
import { createEvaluationsRouter } from "../../evaluations/http/evaluations.routes.js";
import { createCredentialsRouter } from "../../evidences/http/credentials.routes.js";
import { createEvidencesRouter } from "../../evidences/http/evidences.routes.js";
import { createStudentEvidencesRouter } from "../../evidences/http/student-evidences.routes.js";
import { createProfilesRouter } from "../../profiles/http/profiles.routes.js";
import { createSkillCategoriesRouter } from "../../skills/http/skill-categories.routes.js";
import { createSkillsRouter } from "../../skills/http/skills.routes.js";
import { createStudentSkillsRouter } from "../../skills/http/student-skills.routes.js";
import { createAttendancesRouter } from "../../workshops/http/attendances.routes.js";
import { createWorkshopSkillsRouter } from "../../workshops/http/workshop-skills.routes.js";
import { createWorkshopsRouter } from "../../workshops/http/workshops.routes.js";
import { type AuthOptions, authOptionsFromEnv, authenticate } from "./authenticate.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";

export const API_PREFIX = "/api/v1";

/** Los ids son bigint: en JSON salen como texto para no perder precisión (ADR-002 §2.4). */
const jsonReplacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

/** Construye la app sin escuchar puertos (para poder probarla). La arranca `src/server.ts`. */
export function createApp(container: Container, auth: AuthOptions = authOptionsFromEnv()): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("json replacer", jsonReplacer);
  // CORS_ORIGIN (opcional): orígenes permitidos separados por comas. Sin él se permite cualquiera.
  const origins = process.env["CORS_ORIGIN"]?.split(",").map((o) => o.trim());
  app.use(cors(origins ? { origin: origins } : {}));
  app.use(express.json({ limit: "1mb" }));

  const api = Router();
  // Rutas públicas: estado y autenticación (ADR-003).
  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  api.use(createAuthRouter(container));
  api.use(authenticate(container.profiles, auth));
  // Un router por entidad.
  api.use(createChildrenRouter(container));
  api.use(createGuardiansRouter(container));
  api.use(createProfessionalsRouter(container));
  api.use(createAdministratorsRouter(container));
  api.use(createProfilesRouter(container));
  api.use(createAppsRouter(container));
  api.use(createRolesRouter(container));
  api.use(createUserRolesRouter(container));
  api.use(createSkillCategoriesRouter(container));
  api.use(createSkillsRouter(container));
  api.use(createStudentSkillsRouter(container));
  api.use(createEvaluationScalesRouter(container));
  api.use(createEvaluationsRouter(container));
  api.use(createWorkshopsRouter(container));
  api.use(createWorkshopSkillsRouter(container));
  api.use(createAttendancesRouter(container));
  api.use(createEvidencesRouter(container));
  api.use(createStudentEvidencesRouter(container));
  api.use(createCredentialsRouter(container));

  app.use(API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
