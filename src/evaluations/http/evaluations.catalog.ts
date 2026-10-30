import { Router } from "express";
import type { EvaluationScalesService } from "../application/evaluation-scales.service.js";
import type { EvaluationsService } from "../application/evaluations.service.js";
import { createEvaluationScalesRouter } from "./evaluation-scales.routes.js";
import { createEvaluationsRouter } from "./evaluations.routes.js";

/** Catálogo de rutas del módulo: escalas de evaluación y evaluaciones. */
export function createEvaluationsCatalog(services: {
  evaluationScales: EvaluationScalesService;
  evaluations: EvaluationsService;
}): Router {
  const router = Router();
  router.use(createEvaluationScalesRouter(services));
  router.use(createEvaluationsRouter(services));
  return router;
}
