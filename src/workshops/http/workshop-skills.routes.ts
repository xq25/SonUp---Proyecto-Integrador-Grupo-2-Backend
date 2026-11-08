import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, idParams, principalOf, readParams } from "../../shared/http/request.js";
import type { WorkshopSkillsService } from "../application/workshop-skills.service.js";

// Habilidades de cada taller.

const workshopSkillParams = z.object({ id: idSchema, skillId: idSchema });

export function createWorkshopSkillsRouter({
  workshopSkills,
  access,
}: {
  workshopSkills: WorkshopSkillsService;
  access: AccessPolicy;
}): Router {
  const router = Router();

  router.get("/workshops/:id/skills", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadWorkshop(principalOf(res), id);
    res.json(await workshopSkills.listByWorkshop(id));
  });
  /** Asocia la habilidad (o restaura la asociación eliminada). */
  router.put("/workshops/:id/skills/:skillId", async (req, res) => {
    const { id, skillId } = readParams(workshopSkillParams, req);
    await access.assertCanManageWorkshop(principalOf(res), id);
    res.json(await workshopSkills.add(id, skillId, actorOf(res)));
  });
  router.delete("/workshops/:id/skills/:skillId", async (req, res) => {
    const { id, skillId } = readParams(workshopSkillParams, req);
    await access.assertCanManageWorkshop(principalOf(res), id);
    await workshopSkills.remove(id, skillId, actorOf(res));
    res.status(204).end();
  });

  return router;
}
