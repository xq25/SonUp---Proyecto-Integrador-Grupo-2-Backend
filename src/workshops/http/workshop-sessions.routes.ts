import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { actorOf, idParams, principalOf, readParams } from "../../shared/http/request.js";
import type { WorkshopSessionsService } from "../application/workshop-sessions.service.js";

// Sesiones de cada taller (ADR-009).

export function createWorkshopSessionsRouter({
  workshopSessions,
  access,
}: {
  workshopSessions: WorkshopSessionsService;
  access: AccessPolicy;
}): Router {
  const router = Router();

  router.get("/workshops/:id/sessions", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadWorkshop(principalOf(res), id);
    res.json(await workshopSessions.listByWorkshop(id));
  });
  /** Nace `planned`. */
  router.post("/workshops/:id/sessions", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageWorkshop(principalOf(res), id);
    res.status(201).json(await workshopSessions.create(id, req.body, actorOf(res)));
  });
  router.get("/sessions/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadSession(principalOf(res), id);
    res.json(await workshopSessions.get(id));
  });
  router.patch("/sessions/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageSession(principalOf(res), id);
    res.json(await workshopSessions.update(id, req.body, actorOf(res)));
  });
  /** Abre la asistencia y la evaluación. */
  router.post("/sessions/:id/start", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageSession(principalOf(res), id);
    res.json(await workshopSessions.start(id, actorOf(res)));
  });
  /** Guarda el fin real y carga las evaluaciones a las calificaciones. */
  router.post("/sessions/:id/finish", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageSession(principalOf(res), id);
    res.json(await workshopSessions.finish(id, req.body ?? {}, actorOf(res)));
  });
  router.delete("/sessions/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanManageSession(principalOf(res), id);
    await workshopSessions.delete(id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
