import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { actorOf, idParams, principalOf, readParams } from "../../shared/http/request.js";
import type { EvidencesService } from "../application/evidences.service.js";

// Evidencias.

export function createEvidencesRouter({ evidences, access }: { evidences: EvidencesService; access: AccessPolicy }): Router {
  const router = Router();

  router.post("/evidences", async (req, res) => {
    res.status(201).json(await evidences.upload(req.body, actorOf(res)));
  });
  router.get("/evidences/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadEvidence(principalOf(res), id);
    res.json(await evidences.get(id));
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
