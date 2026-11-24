import { Router } from "express";
import { z } from "zod";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { principalOf, readParams, readQuery, studentParams } from "../../shared/http/request.js";
import type { StudentSkillsService } from "../application/student-skills.service.js";

// Calificaciones (calculadas) de cada estudiante.

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Debe ser un mes con formato YYYY-MM");
const progressQuery = z.strictObject({ from: month.exactOptional(), to: month.exactOptional() });

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
  /** Progreso mes a mes: calificación acumulada al cierre de cada mes (`?from=YYYY-MM&to=YYYY-MM`). */
  router.get("/students/:studentId/progress", async (req, res) => {
    const { studentId } = readParams(studentParams, req);
    await access.assertCanReadStudentProgress(principalOf(res), studentId);
    res.json(await studentSkills.getProgress(studentId, readQuery(progressQuery, req)));
  });

  return router;
}
