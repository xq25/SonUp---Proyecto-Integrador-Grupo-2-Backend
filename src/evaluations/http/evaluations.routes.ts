import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, principalOf, readParams } from "../../shared/http/request.js";
import { bodyId } from "../../auth/application/access-policy.js";
import type { EvaluationsService } from "../application/evaluations.service.js";

// Evaluaciones de habilidades en una asistencia.

const attendanceParams = z.object({ attendanceId: idSchema });
const evaluationParams = z.object({ attendanceId: idSchema, workshopSkillId: idSchema });
const studentSkillParams = z.object({ studentId: idSchema, skillId: idSchema });

export function createEvaluationsRouter({ evaluations, access }: { evaluations: EvaluationsService; access: AccessPolicy }): Router {
  const router = Router();

  /** Crea o cambia la escala de una habilidad en una asistencia; recalcula la calificación. */
  router.post("/evaluations", async (req, res) => {
    const attendanceId = bodyId(req.body, "workshopAttendanceId");
    if (attendanceId !== undefined) await access.assertCanManageAttendance(principalOf(res), attendanceId);
    res.status(201).json(await evaluations.evaluate(req.body, actorOf(res)));
  });
  router.get("/attendances/:attendanceId/evaluations", async (req, res) => {
    const { attendanceId } = readParams(attendanceParams, req);
    await access.assertCanReadAttendance(principalOf(res), attendanceId);
    res.json(await evaluations.listByAttendance(attendanceId));
  });
  router.delete("/attendances/:attendanceId/evaluations/:workshopSkillId", async (req, res) => {
    const { attendanceId, workshopSkillId } = readParams(evaluationParams, req);
    await access.assertCanManageAttendance(principalOf(res), attendanceId);
    await evaluations.remove(attendanceId, workshopSkillId, actorOf(res));
    res.status(204).end();
  });
  /** Recálculo manual de la calificación (p. ej. tras cambiar escalas). */
  router.post("/students/:studentId/skills/:skillId/recalculate", async (req, res) => {
    const { studentId, skillId } = readParams(studentSkillParams, req);
    res.json(await evaluations.recalculateStudentSkill(studentId, skillId, actorOf(res)));
  });

  return router;
}
