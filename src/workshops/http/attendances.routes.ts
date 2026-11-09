import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { actorOf, idParams, principalOf, readParams, studentParams } from "../../shared/http/request.js";
import { bodyId } from "../../auth/application/access-policy.js";
import type { AttendanceService } from "../application/attendance.service.js";

// Asistencias a talleres.

export function createAttendancesRouter({ attendance, access }: { attendance: AttendanceService; access: AccessPolicy }): Router {
  const router = Router();

  router.get("/workshops/:id/attendances", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageWorkshop(principalOf(res), id);
    res.json(await attendance.listByWorkshop(id));
  });
  router.get("/students/:studentId/attendances", async (req, res) => {
    const { studentId } = readParams(studentParams, req);
    await access.assertCanReadStudent(principalOf(res), studentId);
    res.json(await attendance.listByStudent(studentId));
  });
  router.post("/attendances", async (req, res) => {
    const workshopId = bodyId(req.body, "workshopId");
    if (workshopId !== undefined) await access.assertCanManageWorkshop(principalOf(res), workshopId);
    res.status(201).json(await attendance.register(req.body, actorOf(res)));
  });
  router.get("/attendances/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadAttendance(principalOf(res), id);
    res.json(await attendance.get(id));
  });
  router.patch("/attendances/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageAttendance(principalOf(res), id);
    res.json(await attendance.update(id, req.body, actorOf(res)));
  });
  router.delete("/attendances/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageAttendance(principalOf(res), id);
    await attendance.delete(id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
