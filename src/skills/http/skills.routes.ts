import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, booleanQuery, idParams, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { SkillsService } from "../application/skills.service.js";
import { SKILL_STATUSES } from "../domain/skill.entity.js";

// Habilidades.

const skillsQuery = z.strictObject({
  skillCategoryId: idSchema.exactOptional(),
  status: z.enum(SKILL_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});

export function createSkillsRouter({ skills }: { skills: SkillsService }): Router {
  const router = Router();

  router.get("/skills", async (req, res) => {
    res.json(await skills.list(readQuery(skillsQuery, req)));
  });
  router.get("/skills/:id", async (req, res) => {
    res.json(await skills.get(readParams(idParams, req).id));
  });
  router.post("/skills", async (req, res) => {
    res.status(201).json(await skills.create(req.body, actorOf(res)));
  });
  router.patch("/skills/:id", async (req, res) => {
    res.json(await skills.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/skills/:id", async (req, res) => {
    await skills.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
