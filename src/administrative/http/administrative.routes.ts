import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { NotFoundError } from "../../shared/domain/errors.js";
import {
  activeOnlyQuery,
  booleanQuery,
  idParams,
  readParams,
  readQuery,
  searchQuery,
} from "../../shared/http/request.js";
import type { AdministrativeService } from "../application/administrative.service.js";

// Módulo administrativo: solo lectura (children, guardians, professionals).

const childrenQuery = z.strictObject({
  statusId: z.coerce.number({ error: "Debe ser un número" }).int("Debe ser un entero").exactOptional(),
  search: searchQuery.exactOptional(),
});
const guardiansQuery = z.strictObject({ search: searchQuery.exactOptional() });
const professionalsQuery = z.strictObject({ timeDonor: booleanQuery.exactOptional() });
const documentParams = z.object({ documentNumber: z.string().trim().min(1).max(30) });
const staffParams = z.object({ staffId: idSchema });

export function createAdministrativeRouter({ administrative }: { administrative: AdministrativeService }): Router {
  const router = Router();

  // ── Estudiantes ──
  router.get("/children", async (req, res) => {
    res.json(await administrative.listChildren(readQuery(childrenQuery, req)));
  });
  router.get("/children/by-document/:documentNumber", async (req, res) => {
    const { documentNumber } = readParams(documentParams, req);
    const child = await administrative.findChildByDocument(documentNumber);
    if (!child) throw new NotFoundError(`Estudiante con documento "${documentNumber}"`);
    res.json(child);
  });
  router.get("/children/:id", async (req, res) => {
    res.json(await administrative.getChild(readParams(idParams, req).id));
  });
  router.get("/children/:id/guardians", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    res.json(await administrative.getChildGuardians(readParams(idParams, req).id, activeOnly ?? true));
  });

  // ── Acudientes ──
  router.get("/guardians", async (req, res) => {
    res.json(await administrative.listGuardians(readQuery(guardiansQuery, req)));
  });
  router.get("/guardians/:id", async (req, res) => {
    res.json(await administrative.getGuardian(readParams(idParams, req).id));
  });
  router.get("/guardians/:id/children", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    res.json(await administrative.getGuardianChildren(readParams(idParams, req).id, activeOnly ?? true));
  });

  // ── Talleristas ──
  router.get("/professionals", async (req, res) => {
    res.json(await administrative.listProfessionals(readQuery(professionalsQuery, req)));
  });
  router.get("/professionals/by-staff/:staffId", async (req, res) => {
    const { staffId } = readParams(staffParams, req);
    const professional = await administrative.findProfessionalByStaffId(staffId);
    if (!professional) throw new NotFoundError(`Tallerista con staff_id "${staffId}"`);
    res.json(professional);
  });
  router.get("/professionals/:id", async (req, res) => {
    res.json(await administrative.getProfessional(readParams(idParams, req).id));
  });

  return router;
}
