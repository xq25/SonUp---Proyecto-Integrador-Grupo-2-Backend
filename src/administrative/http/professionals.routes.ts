import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { NotFoundError } from "../../shared/domain/errors.js";
import { booleanQuery, idParams, principalOf, readParams, readQuery } from "../../shared/http/request.js";
import type { ProfessionalsService } from "../application/professionals.service.js";

// Talleristas del módulo administrativo (solo lectura).

const professionalsQuery = z.strictObject({ timeDonor: booleanQuery.exactOptional() });
const staffParams = z.object({ staffId: idSchema });

export function createProfessionalsRouter({
  professionals,
  access,
}: {
  professionals: ProfessionalsService;
  access: AccessPolicy;
}): Router {
  const router = Router();

  router.get("/professionals", async (req, res) => {
    res.json(await professionals.list(readQuery(professionalsQuery, req)));
  });
  router.get("/professionals/by-staff/:staffId", async (req, res) => {
    const { staffId } = readParams(staffParams, req);
    await access.assertCanReadStaff(principalOf(res), staffId);
    const professional = await professionals.findByStaffId(staffId);
    if (!professional) throw new NotFoundError(`Tallerista con staff_id "${staffId}"`);
    res.json(professional);
  });
  router.get("/professionals/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadProfessional(principalOf(res), id);
    res.json(await professionals.get(id));
  });

  return router;
}
