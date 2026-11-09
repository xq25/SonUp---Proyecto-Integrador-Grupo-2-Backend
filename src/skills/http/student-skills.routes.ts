import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { principalOf, readParams, studentParams } from "../../shared/http/request.js";
import type { StudentSkillsService } from "../application/student-skills.service.js";

// Calificaciones (calculadas) de cada estudiante.

export function createStudentSkillsRouter({
  studentSkills,
  access,
}: {
  studentSkills: StudentSkillsService;
  access: AccessPolicy;
}): Router {
  const router = Router();

  router.get("/students/:studentId/skills", async (req, res) => {
    const { studentId } = readParams(studentParams, req);
    await access.assertCanReadStudent(principalOf(res), studentId);
    res.json(await studentSkills.listByStudent(studentId));
  });
  router.get("/students/:studentId/category-averages", async (req, res) => {
    const { studentId } = readParams(studentParams, req);
    await access.assertCanReadStudent(principalOf(res), studentId);
    res.json(await studentSkills.getCategoryAverages(studentId));
  });

  return router;
}
