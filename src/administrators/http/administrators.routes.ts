import { Router } from "express";
import { z } from "zod";
import { actorOf, booleanQuery, idParams, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { AdministratorsService } from "../application/administrators.service.js";
import { ADMINISTRATOR_STATUSES } from "../domain/administrator.entity.js";

// Administrativos (tabla provisional).

const listQuery = z.strictObject({
  status: z.enum(ADMINISTRATOR_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});

export function createAdministratorsRouter({ administrators }: { administrators: AdministratorsService }): Router {
  const router = Router();

  router.get("/administrators", async (req, res) => {
    res.json(await administrators.list(readQuery(listQuery, req)));
  });
  router.get("/administrators/:id", async (req, res) => {
    res.json(await administrators.get(readParams(idParams, req).id));
  });
  router.post("/administrators", async (req, res) => {
    res.status(201).json(await administrators.create(req.body, actorOf(res)));
  });
  router.patch("/administrators/:id", async (req, res) => {
    res.json(await administrators.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/administrators/:id", async (req, res) => {
    await administrators.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });
  router.post("/administrators/:id/restore", async (req, res) => {
    res.json(await administrators.restore(readParams(idParams, req).id, actorOf(res)));
  });

  return router;
}
