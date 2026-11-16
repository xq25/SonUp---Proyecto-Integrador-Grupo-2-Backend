import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import type { AttendanceService } from "../application/attendance.service.js";
import type { WorkshopSkillsService } from "../application/workshop-skills.service.js";
import type { WorkshopsService } from "../application/workshops.service.js";
import type { WorkshopSessionsService } from "../application/workshop-sessions.service.js";
import { createAttendancesRouter } from "./attendances.routes.js";
import { createWorkshopSkillsRouter } from "./workshop-skills.routes.js";
import { createWorkshopSessionsRouter } from "./workshop-sessions.routes.js";
import { createWorkshopsRouter } from "./workshops.routes.js";

/** Catálogo de rutas del módulo: talleres, sus habilidades, sus sesiones y las asistencias. */
export function createWorkshopsCatalog(services: {
  access: AccessPolicy;
  workshops: WorkshopsService;
  workshopSkills: WorkshopSkillsService;
  workshopSessions: WorkshopSessionsService;
  attendance: AttendanceService;
}): Router {
  const router = Router();
  router.use(createWorkshopsRouter(services));
  router.use(createWorkshopSkillsRouter(services));
  router.use(createWorkshopSessionsRouter(services));
  router.use(createAttendancesRouter(services));
  return router;
}
