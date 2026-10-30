import { Router } from "express";
import { z } from "zod";
import { activeOnlyQuery, idParams, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { GuardiansService } from "../application/guardians.service.js";

// Acudientes del módulo administrativo (solo lectura).

const guardiansQuery = z.strictObject({ search: searchQuery.exactOptional() });

export function createGuardiansRouter({ guardians }: { guardians: GuardiansService }): Router {
  const router = Router();

  router.get("/guardians", async (req, res) => {
    res.json(await guardians.list(readQuery(guardiansQuery, req)));
  });
  router.get("/guardians/:id", async (req, res) => {
    res.json(await guardians.get(readParams(idParams, req).id));
  });
  router.get("/guardians/:id/children", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    res.json(await guardians.getChildren(readParams(idParams, req).id, activeOnly ?? true));
  });

  return router;
}
