import { Router } from "express";
import { z } from "zod";
import { actorOf, activeOnlyQuery, idParams, readParams, readQuery } from "../../shared/http/request.js";
import type { EvaluationScalesService } from "../application/evaluation-scales.service.js";

// Escalas de evaluación. Las rutas fijas van antes de `/:id`.

const classifyQuery = z.strictObject({ value: z.coerce.number({ error: "Debe ser un número" }) });

export function createEvaluationScalesRouter({ evaluationScales }: { evaluationScales: EvaluationScalesService }): Router {
  const router = Router();

  router.get("/evaluation-scales", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    res.json(await evaluationScales.list(activeOnly ?? true));
  });
  router.get("/evaluation-scales/coverage-gaps", async (_req, res) => {
    res.json(await evaluationScales.getCoverageGaps());
  });
  router.get("/evaluation-scales/classify", async (req, res) => {
    res.json(await evaluationScales.classify(readQuery(classifyQuery, req).value));
  });
  router.get("/evaluation-scales/:id", async (req, res) => {
    res.json(await evaluationScales.get(readParams(idParams, req).id));
  });
  router.post("/evaluation-scales", async (req, res) => {
    res.status(201).json(await evaluationScales.create(req.body, actorOf(res)));
  });
  router.patch("/evaluation-scales/:id", async (req, res) => {
    res.json(await evaluationScales.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/evaluation-scales/:id", async (req, res) => {
    await evaluationScales.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
