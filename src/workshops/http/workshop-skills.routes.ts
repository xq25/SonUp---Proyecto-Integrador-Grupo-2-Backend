import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, idParams, readParams } from "../../shared/http/request.js";
import type { WorkshopSkillsService } from "../application/workshop-skills.service.js";

// Habilidades de cada taller.

const workshopSkillParams = z.object({ id: idSchema, skillId: idSchema });

export function createWorkshopSkillsRouter({ workshopSkills }: { workshopSkills: WorkshopSkillsService }): Router {
  const router = Router();

  router.get("/workshops/:id/skills", async (req, res) => {
    res.json(await workshopSkills.listByWorkshop(readParams(idParams, req).id));
  });
  /** Asocia la habilidad (o restaura la asociación eliminada). */
  router.put("/workshops/:id/skills/:skillId", async (req, res) => {
    const { id, skillId } = readParams(workshopSkillParams, req);
    res.json(await workshopSkills.add(id, skillId, actorOf(res)));
  });
  router.delete("/workshops/:id/skills/:skillId", async (req, res) => {
    const { id, skillId } = readParams(workshopSkillParams, req);
    await workshopSkills.remove(id, skillId, actorOf(res));
    res.status(204).end();
  });

  return router;
}
