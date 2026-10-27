import { Router } from "express";
import { z } from "zod";
import { uuidSchema } from "../../shared/application/schemas.js";
import { actorOf, idParams, readParams, readQuery } from "../../shared/http/request.js";
import type { AccessService } from "../application/access.service.js";

// Acceso: catálogos de aplicaciones y roles, y roles de cada usuario.

const appQuery = z.strictObject({ app: z.string().trim().min(1).max(50).exactOptional() });
const userParams = z.object({ userId: uuidSchema });
const userRoleParams = z.object({ userId: uuidSchema, role: z.string().trim().min(1).max(50) });

export function createAccessRouter({ access }: { access: AccessService }): Router {
  const router = Router();

  // ── Catálogos ──
  router.get("/apps", async (_req, res) => {
    res.json(await access.listApps());
  });
  router.post("/apps", async (req, res) => {
    res.status(201).json(await access.createApp(req.body, actorOf(res)));
  });
  router.get("/roles", async (_req, res) => {
    res.json(await access.listRoles());
  });
  router.post("/roles", async (req, res) => {
    res.status(201).json(await access.createRole(req.body, actorOf(res)));
  });

  // ── Roles de un usuario ──
  router.get("/profiles/:userId/roles", async (req, res) => {
    const { app } = readQuery(appQuery, req);
    res.json(await access.getUserRoles(readParams(userParams, req).userId, app));
  });
  router.get("/profiles/:userId/roles/:role", async (req, res) => {
    const { app } = readQuery(appQuery, req);
    const { userId, role } = readParams(userRoleParams, req);
    res.json({ hasRole: await access.hasRole(userId, role, app) });
  });
  router.post("/user-roles", async (req, res) => {
    res.status(201).json(await access.assignRole(req.body, actorOf(res)));
  });
  router.delete("/user-roles/:id", async (req, res) => {
    await access.revokeRole(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
