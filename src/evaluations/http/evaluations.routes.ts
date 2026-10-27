import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, activeOnlyQuery, idParams, readParams, readQuery } from "../../shared/http/request.js";
import type { EvaluationsService } from "../application/evaluations.service.js";

// Escalas de evaluación y evaluaciones de habilidades en una asistencia.

const classifyQuery = z.strictObject({ value: z.coerce.number({ error: "Debe ser un número" }) });
const attendanceParams = z.object({ attendanceId: idSchema });
const evaluationParams = z.object({ attendanceId: idSchema, workshopSkillId: idSchema });
const studentSkillParams = z.object({ studentId: idSchema, skillId: idSchema });

export function createEvaluationsRouter({ evaluations }: { evaluations: EvaluationsService }): Router {
  const router = Router();

  // ── Escalas ── (las rutas fijas van antes de `/:id`)
  router.get("/evaluation-scales", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    res.json(await evaluations.listScales(activeOnly ?? true));
  });
  router.get("/evaluation-scales/coverage-gaps", async (_req, res) => {
    res.json(await evaluations.getCoverageGaps());
  });
  router.get("/evaluation-scales/classify", async (req, res) => {
    res.json(await evaluations.classify(readQuery(classifyQuery, req).value));
  });
  router.get("/evaluation-scales/:id", async (req, res) => {
    res.json(await evaluations.getScale(readParams(idParams, req).id));
  });
  router.post("/evaluation-scales", async (req, res) => {
    res.status(201).json(await evaluations.createScale(req.body, actorOf(res)));
  });
  router.patch("/evaluation-scales/:id", async (req, res) => {
    res.json(await evaluations.updateScale(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/evaluation-scales/:id", async (req, res) => {
    await evaluations.deleteScale(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  // ── Evaluaciones ──
  /** Crea o cambia la escala de una habilidad en una asistencia; recalcula la calificación. */
  router.post("/evaluations", async (req, res) => {
    res.status(201).json(await evaluations.evaluate(req.body, actorOf(res)));
  });
  router.get("/attendances/:attendanceId/evaluations", async (req, res) => {
    res.json(await evaluations.listByAttendance(readParams(attendanceParams, req).attendanceId));
  });
  router.delete("/attendances/:attendanceId/evaluations/:workshopSkillId", async (req, res) => {
    const { attendanceId, workshopSkillId } = readParams(evaluationParams, req);
    await evaluations.removeEvaluation(attendanceId, workshopSkillId, actorOf(res));
    res.status(204).end();
  });
  /** Recálculo manual de la calificación (p. ej. tras cambiar escalas). */
  router.post("/students/:studentId/skills/:skillId/recalculate", async (req, res) => {
    const { studentId, skillId } = readParams(studentSkillParams, req);
    res.json(await evaluations.recalculateStudentSkill(studentId, skillId, actorOf(res)));
  });

  return router;
}
