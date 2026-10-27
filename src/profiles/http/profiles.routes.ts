import { Router } from "express";
import { z } from "zod";
import { actorOf, booleanQuery, readParams, readQuery, searchQuery, uuidParams } from "../../shared/http/request.js";
import type { ProfilesService } from "../application/profiles.service.js";
import { PROFILE_STATUSES } from "../domain/profile.entity.js";

// Perfiles (cuentas de Supabase Auth). Los crea el trigger `crear_perfil`, no la API.

const listQuery = z.strictObject({
  status: z.enum(PROFILE_STATUSES).exactOptional(),
  search: searchQuery.exactOptional(),
  includeDeleted: booleanQuery.exactOptional(),
});

export function createProfilesRouter({ profiles }: { profiles: ProfilesService }): Router {
  const router = Router();

  router.get("/profiles", async (req, res) => {
    res.json(await profiles.list(readQuery(listQuery, req)));
  });
  /** Perfil del usuario autenticado. */
  router.get("/profiles/me", async (_req, res) => {
    res.json(await profiles.get(actorOf(res)));
  });
  router.get("/profiles/:id", async (req, res) => {
    res.json(await profiles.get(readParams(uuidParams, req).id));
  });
  router.patch("/profiles/:id", async (req, res) => {
    res.json(await profiles.update(readParams(uuidParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/profiles/:id", async (req, res) => {
    await profiles.delete(readParams(uuidParams, req).id, actorOf(res));
    res.status(204).end();
  });
  router.post("/profiles/:id/restore", async (req, res) => {
    res.json(await profiles.restore(readParams(uuidParams, req).id, actorOf(res)));
  });

  return router;
}
