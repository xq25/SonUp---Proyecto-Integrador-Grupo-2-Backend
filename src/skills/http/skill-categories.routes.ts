import { Router } from "express";
import { actorOf, idParams, readParams } from "../../shared/http/request.js";
import type { SkillCategoriesService } from "../application/skill-categories.service.js";

// Categorías de habilidades.

export function createSkillCategoriesRouter({ skillCategories }: { skillCategories: SkillCategoriesService }): Router {
  const router = Router();

  router.get("/skill-categories", async (_req, res) => {
    res.json(await skillCategories.list());
  });
  router.get("/skill-categories/:id", async (req, res) => {
    res.json(await skillCategories.get(readParams(idParams, req).id));
  });
  router.post("/skill-categories", async (req, res) => {
    res.status(201).json(await skillCategories.create(req.body, actorOf(res)));
  });
  router.patch("/skill-categories/:id", async (req, res) => {
    res.json(await skillCategories.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/skill-categories/:id", async (req, res) => {
    await skillCategories.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
