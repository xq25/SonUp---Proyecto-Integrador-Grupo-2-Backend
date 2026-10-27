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
import type { AttendanceService } from "../application/attendance.service.js";
import type { WorkshopsService } from "../application/workshops.service.js";
import { WORKSHOP_STATUSES } from "../domain/workshop.entity.js";

// Talleres, sus habilidades y las asistencias.

const listQuery = z.strictObject({
  evaluatorId: idSchema.exactOptional(),
  status: z.enum(WORKSHOP_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});
const workshopSkillParams = z.object({ id: idSchema, skillId: idSchema });

export function createWorkshopsRouter({
  workshops,
  attendance,
}: {
  workshops: WorkshopsService;
  attendance: AttendanceService;
}): Router {
  const router = Router();

  // ── Talleres ──
  router.get("/workshops", async (req, res) => {
    res.json(await workshops.list(readQuery(listQuery, req)));
  });
  router.get("/workshops/:id", async (req, res) => {
    res.json(await workshops.get(readParams(idParams, req).id));
  });
  router.post("/workshops", async (req, res) => {
    res.status(201).json(await workshops.create(req.body, actorOf(res)));
  });
  /** Edita datos (solo `planned`) o cambia el estado (ciclo de vida). */
  router.patch("/workshops/:id", async (req, res) => {
    res.json(await workshops.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/workshops/:id", async (req, res) => {
    await workshops.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  // ── Habilidades del taller ──
  router.get("/workshops/:id/skills", async (req, res) => {
    res.json(await workshops.listSkills(readParams(idParams, req).id));
  });
  /** Asocia la habilidad (o restaura la asociación eliminada). */
  router.put("/workshops/:id/skills/:skillId", async (req, res) => {
    const { id, skillId } = readParams(workshopSkillParams, req);
    res.json(await workshops.addSkill(id, skillId, actorOf(res)));
  });
  router.delete("/workshops/:id/skills/:skillId", async (req, res) => {
    const { id, skillId } = readParams(workshopSkillParams, req);
    await workshops.removeSkill(id, skillId, actorOf(res));
    res.status(204).end();
  });

  // ── Asistencias ──
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
