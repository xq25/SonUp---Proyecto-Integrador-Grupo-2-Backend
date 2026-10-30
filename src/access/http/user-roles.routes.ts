import { Router } from "express";
import { z } from "zod";
import { uuidSchema } from "../../shared/application/schemas.js";
import { actorOf, idParams, readParams, readQuery } from "../../shared/http/request.js";
import type { UserRolesService } from "../application/user-roles.service.js";

// Roles de cada usuario.

const appQuery = z.strictObject({ app: z.string().trim().min(1).max(50).exactOptional() });
const userParams = z.object({ userId: uuidSchema });
const userRoleParams = z.object({ userId: uuidSchema, role: z.string().trim().min(1).max(50) });

export function createUserRolesRouter({ userRoles }: { userRoles: UserRolesService }): Router {
  const router = Router();

  router.get("/profiles/:userId/roles", async (req, res) => {
    const { app } = readQuery(appQuery, req);
    res.json(await userRoles.getUserRoles(readParams(userParams, req).userId, app));
  });
  router.get("/profiles/:userId/roles/:role", async (req, res) => {
    const { app } = readQuery(appQuery, req);
    const { userId, role } = readParams(userRoleParams, req);
    res.json({ hasRole: await userRoles.hasRole(userId, role, app) });
  });
  router.post("/user-roles", async (req, res) => {
    res.status(201).json(await userRoles.assign(req.body, actorOf(res)));
  });
  router.delete("/user-roles/:id", async (req, res) => {
    await userRoles.revoke(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });

  return router;
}
