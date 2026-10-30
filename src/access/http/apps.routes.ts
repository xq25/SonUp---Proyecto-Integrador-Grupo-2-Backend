import { Router } from "express";
import { actorOf } from "../../shared/http/request.js";
import type { AppsService } from "../application/apps.service.js";

// Catálogo de aplicaciones.

export function createAppsRouter({ apps }: { apps: AppsService }): Router {
  const router = Router();

  router.get("/apps", async (_req, res) => {
    res.json(await apps.list());
  });
  router.post("/apps", async (req, res) => {
    res.status(201).json(await apps.create(req.body, actorOf(res)));
  });

  return router;
}
