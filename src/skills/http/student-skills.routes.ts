import { Router } from "express";
import { readParams, studentParams } from "../../shared/http/request.js";
import type { StudentSkillsService } from "../application/student-skills.service.js";

// Calificaciones (calculadas) de cada estudiante.

export function createStudentSkillsRouter({ studentSkills }: { studentSkills: StudentSkillsService }): Router {
  const router = Router();

  router.get("/students/:studentId/skills", async (req, res) => {
    res.json(await studentSkills.listByStudent(readParams(studentParams, req).studentId));
  });
  router.get("/students/:studentId/category-averages", async (req, res) => {
    res.json(await studentSkills.getCategoryAverages(readParams(studentParams, req).studentId));
  });

  return router;
}
