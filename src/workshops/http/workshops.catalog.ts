import { Router } from "express";
import type { AttendanceService } from "../application/attendance.service.js";
import type { WorkshopSkillsService } from "../application/workshop-skills.service.js";
import type { WorkshopsService } from "../application/workshops.service.js";
import { createAttendancesRouter } from "./attendances.routes.js";
import { createWorkshopSkillsRouter } from "./workshop-skills.routes.js";
import { createWorkshopsRouter } from "./workshops.routes.js";

/** Catálogo de rutas del módulo: talleres, sus habilidades y asistencias. */
export function createWorkshopsCatalog(services: {
  workshops: WorkshopsService;
  workshopSkills: WorkshopSkillsService;
  attendance: AttendanceService;
}): Router {
  const router = Router();
  router.use(createWorkshopsRouter(services));
  router.use(createWorkshopSkillsRouter(services));
  router.use(createAttendancesRouter(services));
  return router;
}
