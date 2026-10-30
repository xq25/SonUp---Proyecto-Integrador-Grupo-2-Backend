import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../shared/domain/errors.js";
import { activeOnlyQuery, idParams, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { ChildrenService } from "../application/children.service.js";

// Estudiantes del módulo administrativo (solo lectura).

const childrenQuery = z.strictObject({
  statusId: z.coerce.number({ error: "Debe ser un número" }).int("Debe ser un entero").exactOptional(),
  search: searchQuery.exactOptional(),
});
const documentParams = z.object({ documentNumber: z.string().trim().min(1).max(30) });

export function createChildrenRouter({ children }: { children: ChildrenService }): Router {
  const router = Router();

  router.get("/children", async (req, res) => {
    res.json(await children.list(readQuery(childrenQuery, req)));
  });
  router.get("/children/by-document/:documentNumber", async (req, res) => {
    const { documentNumber } = readParams(documentParams, req);
    const child = await children.findByDocument(documentNumber);
    if (!child) throw new NotFoundError(`Estudiante con documento "${documentNumber}"`);
    res.json(child);
  });
  router.get("/children/:id", async (req, res) => {
    res.json(await children.get(readParams(idParams, req).id));
  });
  router.get("/children/:id/guardians", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    res.json(await children.getGuardians(readParams(idParams, req).id, activeOnly ?? true));
  });

  return router;
}
