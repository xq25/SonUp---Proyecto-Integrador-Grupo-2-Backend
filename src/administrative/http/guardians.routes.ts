import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { activeOnlyQuery, idParams, principalOf, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { GuardiansService } from "../application/guardians.service.js";

// Acudientes del módulo administrativo (solo lectura).

const guardiansQuery = z.strictObject({ search: searchQuery.exactOptional() });

export function createGuardiansRouter({ guardians, access }: { guardians: GuardiansService; access: AccessPolicy }): Router {
  const router = Router();

  router.get("/guardians", async (req, res) => {
    res.json(await guardians.list(readQuery(guardiansQuery, req)));
  });
  router.get("/guardians/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadGuardian(principalOf(res), id);
    res.json(await guardians.get(id));
  });
  router.get("/guardians/:id/children", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    const { id } = readParams(idParams, req);
    await access.assertCanReadGuardian(principalOf(res), id);
    res.json(await guardians.getChildren(id, activeOnly ?? true));
  });

  return router;
}
