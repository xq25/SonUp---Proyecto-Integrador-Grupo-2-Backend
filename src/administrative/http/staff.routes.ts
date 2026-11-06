import { Router } from "express";
import { z } from "zod";
import { idParams, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { StaffService } from "../application/staff.service.js";

// Personal del módulo administrativo (solo lectura): administrativos y talleristas.

const staffQuery = z.strictObject({
  role: z.string().trim().min(1).max(50).exactOptional(),
  status: z.string().trim().min(1).max(50).exactOptional(),
  search: searchQuery.exactOptional(),
});

export function createStaffRouter({ staff }: { staff: StaffService }): Router {
  const router = Router();

  router.get("/staff", async (req, res) => {
    res.json(await staff.list(readQuery(staffQuery, req)));
  });
  router.get("/staff/:id", async (req, res) => {
    res.json(await staff.get(readParams(idParams, req).id));
  });

  return router;
}
