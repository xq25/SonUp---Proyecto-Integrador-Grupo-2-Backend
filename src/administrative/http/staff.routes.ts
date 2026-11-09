import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { idParams, principalOf, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { StaffService } from "../application/staff.service.js";

// Personal del módulo administrativo (solo lectura): administrativos y talleristas.

// roleId y statusId: ids de los catálogos de Saga (staff_role_id, staff_status_id).
const staffQuery = z.strictObject({
  roleId: z.string().trim().min(1).max(50).exactOptional(),
  statusId: z.string().trim().min(1).max(50).exactOptional(),
  search: searchQuery.exactOptional(),
});

export function createStaffRouter({ staff, access }: { staff: StaffService; access: AccessPolicy }): Router {
  const router = Router();

  router.get("/staff", async (req, res) => {
    res.json(await staff.list(readQuery(staffQuery, req)));
  });
  router.get("/staff/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadStaff(principalOf(res), id);
    res.json(await staff.get(id));
  });

  return router;
}
