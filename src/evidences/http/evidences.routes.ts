import { Router } from "express";
import { actorOf, idParams, readParams } from "../../shared/http/request.js";
import type { EvidencesService } from "../application/evidences.service.js";

// Evidencias.

export function createEvidencesRouter({ evidences }: { evidences: EvidencesService }): Router {
  const router = Router();

  router.post("/evidences", async (req, res) => {
    res.status(201).json(await evidences.upload(req.body, actorOf(res)));
  });
  router.get("/evidences/:id", async (req, res) => {
    res.json(await evidences.get(readParams(idParams, req).id));
  });
  router.patch("/evidences/:id", async (req, res) => {
    res.json(await evidences.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/evidences/:id", async (req, res) => {
    await evidences.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
