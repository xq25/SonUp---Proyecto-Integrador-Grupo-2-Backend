import cors from "cors";
import express, { type Express, Router } from "express";
import type { Container } from "../../container.js";
import { createAccessRouter } from "../../access/http/access.routes.js";
import { createAdministrativeRouter } from "../../administrative/http/administrative.routes.js";
import { createAdministratorsRouter } from "../../administrators/http/administrators.routes.js";
import { createEvaluationsRouter } from "../../evaluations/http/evaluations.routes.js";
import { createEvidencesRouter } from "../../evidences/http/evidences.routes.js";
import { createProfilesRouter } from "../../profiles/http/profiles.routes.js";
import { createSkillsRouter } from "../../skills/http/skills.routes.js";
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
  // Única ruta pública.
  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  api.use(authenticate(container.profiles, auth));
  api.use(createAdministrativeRouter(container));
  api.use(createAdministratorsRouter(container));
  api.use(createProfilesRouter(container));
  api.use(createAccessRouter(container));
  api.use(createSkillsRouter(container));
  api.use(createEvaluationsRouter(container));
  api.use(createWorkshopsRouter(container));
  api.use(createEvidencesRouter(container));

  app.use(API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
