import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, booleanQuery, idParams, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { WorkshopsService } from "../application/workshops.service.js";
import { WORKSHOP_STATUSES } from "../domain/workshop.entity.js";

// Talleres.

const listQuery = z.strictObject({
  evaluatorId: idSchema.exactOptional(),
  status: z.enum(WORKSHOP_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});

export function createWorkshopsRouter({ workshops }: { workshops: WorkshopsService }): Router {
  const router = Router();

  router.get("/workshops", async (req, res) => {
    res.json(await workshops.list(readQuery(listQuery, req)));
  });
  router.get("/workshops/:id", async (req, res) => {
    res.json(await workshops.get(readParams(idParams, req).id));
  });
  router.post("/workshops", async (req, res) => {
    res.status(201).json(await workshops.create(req.body, actorOf(res)));
  });
  /** Edita datos (solo `planned`) o cambia el estado (ciclo de vida). */
  router.patch("/workshops/:id", async (req, res) => {
    res.json(await workshops.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/workshops/:id", async (req, res) => {
    await workshops.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
