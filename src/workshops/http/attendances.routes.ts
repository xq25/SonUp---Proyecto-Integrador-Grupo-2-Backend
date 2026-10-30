import { Router } from "express";
import { actorOf, idParams, readParams, studentParams } from "../../shared/http/request.js";
import type { AttendanceService } from "../application/attendance.service.js";

// Asistencias a talleres.

export function createAttendancesRouter({ attendance }: { attendance: AttendanceService }): Router {
  const router = Router();

  router.get("/workshops/:id/attendances", async (req, res) => {
    res.json(await attendance.listByWorkshop(readParams(idParams, req).id));
  });
  router.get("/students/:studentId/attendances", async (req, res) => {
    res.json(await attendance.listByStudent(readParams(studentParams, req).studentId));
  });
  router.post("/attendances", async (req, res) => {
    res.status(201).json(await attendance.register(req.body, actorOf(res)));
  });
  router.get("/attendances/:id", async (req, res) => {
    res.json(await attendance.get(readParams(idParams, req).id));
  });
  router.patch("/attendances/:id", async (req, res) => {
    res.json(await attendance.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/attendances/:id", async (req, res) => {
    await attendance.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
