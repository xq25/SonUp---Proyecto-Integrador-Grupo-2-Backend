import { Router } from "express";
import { actorOf } from "../../shared/http/request.js";
import type { RolesService } from "../application/roles.service.js";

// Catálogo de roles.

export function createRolesRouter({ roles }: { roles: RolesService }): Router {
  const router = Router();

  router.get("/roles", async (_req, res) => {
    res.json(await roles.list());
  });
  router.post("/roles", async (req, res) => {
    res.status(201).json(await roles.create(req.body, actorOf(res)));
  });

  return router;
}
