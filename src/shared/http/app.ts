import cors from "cors";
import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import type { Container } from "../../container.js";
import { API_PREFIX, createApiRouter } from "./api.routes.js";
import { type AuthOptions, authOptionsFromEnv } from "./authenticate.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { createSwaggerSpec } from "./swagger.js";

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

  // Documentación interactiva (pública, fuera del prefijo; ADR-005).
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(createSwaggerSpec()));
  app.use(API_PREFIX, createApiRouter(container, auth));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
