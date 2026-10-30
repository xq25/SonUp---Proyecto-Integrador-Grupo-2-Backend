import { Router } from "express";
import type { SkillCategoriesService } from "../application/skill-categories.service.js";
import type { SkillsService } from "../application/skills.service.js";
import type { StudentSkillsService } from "../application/student-skills.service.js";
import { createSkillCategoriesRouter } from "./skill-categories.routes.js";
import { createSkillsRouter } from "./skills.routes.js";
import { createStudentSkillsRouter } from "./student-skills.routes.js";

/** Catálogo de rutas del módulo: categorías, habilidades y calificaciones de cada estudiante. */
export function createSkillsCatalog(services: {
  skillCategories: SkillCategoriesService;
  skills: SkillsService;
  studentSkills: StudentSkillsService;
}): Router {
  const router = Router();
  router.use(createSkillCategoriesRouter(services));
  router.use(createSkillsRouter(services));
  router.use(createStudentSkillsRouter(services));
  return router;
}
