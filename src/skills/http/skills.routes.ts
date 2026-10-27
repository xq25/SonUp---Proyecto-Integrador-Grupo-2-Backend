import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import {
  actorOf,
  booleanQuery,
  idParams,
  readParams,
  readQuery,
  searchQuery,
  studentParams,
} from "../../shared/http/request.js";
import type { SkillsService } from "../application/skills.service.js";
import { SKILL_STATUSES } from "../domain/skill.entity.js";

// Categorías, habilidades y calificaciones (calculadas) de cada estudiante.

const skillsQuery = z.strictObject({
  skillCategoryId: idSchema.exactOptional(),
  status: z.enum(SKILL_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});

export function createSkillsRouter({ skills }: { skills: SkillsService }): Router {
  const router = Router();

  // ── Categorías ──
  router.get("/skill-categories", async (_req, res) => {
    res.json(await skills.listCategories());
  });
  router.get("/skill-categories/:id", async (req, res) => {
    res.json(await skills.getCategory(readParams(idParams, req).id));
  });
  router.post("/skill-categories", async (req, res) => {
    res.status(201).json(await skills.createCategory(req.body, actorOf(res)));
  });
  router.patch("/skill-categories/:id", async (req, res) => {
    res.json(await skills.updateCategory(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/skill-categories/:id", async (req, res) => {
    await skills.deleteCategory(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  // ── Habilidades ──
  router.get("/skills", async (req, res) => {
    res.json(await skills.listSkills(readQuery(skillsQuery, req)));
  });
  router.get("/skills/:id", async (req, res) => {
    res.json(await skills.getSkill(readParams(idParams, req).id));
  });
  router.post("/skills", async (req, res) => {
    res.status(201).json(await skills.createSkill(req.body, actorOf(res)));
  });
  router.patch("/skills/:id", async (req, res) => {
    res.json(await skills.updateSkill(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/skills/:id", async (req, res) => {
    await skills.deleteSkill(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  // ── Calificaciones de un estudiante ──
  router.get("/students/:studentId/skills", async (req, res) => {
    res.json(await skills.listStudentSkills(readParams(studentParams, req).studentId));
  });
  router.get("/students/:studentId/category-averages", async (req, res) => {
    res.json(await skills.getCategoryAverages(readParams(studentParams, req).studentId));
  });

  return router;
}
