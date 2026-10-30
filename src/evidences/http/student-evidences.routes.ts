import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, idParams, readParams, studentParams } from "../../shared/http/request.js";
import type { StudentEvidencesService } from "../application/student-evidences.service.js";

// Estudiantes de cada evidencia.

const evidenceStudentParams = z.object({ id: idSchema, studentId: idSchema });

export function createStudentEvidencesRouter({ studentEvidences }: { studentEvidences: StudentEvidencesService }): Router {
  const router = Router();

  router.get("/evidences/:id/students", async (req, res) => {
    res.json(await studentEvidences.listByEvidence(readParams(idParams, req).id));
  });
  /** Relaciona un estudiante (o restaura la relación eliminada). */
  router.put("/evidences/:id/students/:studentId", async (req, res) => {
    const { id, studentId } = readParams(evidenceStudentParams, req);
    res.json(await studentEvidences.link(id, studentId, actorOf(res)));
  });
  router.delete("/evidences/:id/students/:studentId", async (req, res) => {
    const { id, studentId } = readParams(evidenceStudentParams, req);
    await studentEvidences.unlink(id, studentId, actorOf(res));
    res.status(204).end();
  });
  router.get("/students/:studentId/evidences", async (req, res) => {
    res.json(await studentEvidences.listByStudent(readParams(studentParams, req).studentId));
  });

  return router;
}
