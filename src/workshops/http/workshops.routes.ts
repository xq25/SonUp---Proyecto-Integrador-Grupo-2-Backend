import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, booleanQuery, idParams, principalOf, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { WorkshopsService } from "../application/workshops.service.js";
import { WORKSHOP_STATUSES } from "../domain/workshop.entity.js";

// Talleres.

const listQuery = z.strictObject({
  evaluatorId: idSchema.exactOptional(),
  status: z.enum(WORKSHOP_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});

export function createWorkshopsRouter({ workshops, access }: { workshops: WorkshopsService; access: AccessPolicy }): Router {
  const router = Router();

  router.get("/workshops", async (req, res) => {
    res.json(await workshops.list(await access.workshopFilter(principalOf(res), readQuery(listQuery, req))));
  });
  router.get("/workshops/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadWorkshop(principalOf(res), id);
    res.json(await workshops.get(id));
  });
  router.post("/workshops", async (req, res) => {
    await access.assertCanCreateWorkshop(principalOf(res), req.body);
    res.status(201).json(await workshops.create(req.body, actorOf(res)));
  });
  /** Edita datos (solo `planned`) o cambia el estado (ciclo de vida). */
  router.patch("/workshops/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanUpdateWorkshop(principalOf(res), id, req.body);
    res.json(await workshops.update(id, req.body, actorOf(res)));
  });
  router.delete("/workshops/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageWorkshop(principalOf(res), id);
    await workshops.delete(id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
