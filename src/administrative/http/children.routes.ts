import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { z } from "zod";
import { NotFoundError } from "../../shared/domain/errors.js";
import { activeOnlyQuery, idParams, principalOf, readParams, readQuery, searchQuery } from "../../shared/http/request.js";
import type { ChildrenService } from "../application/children.service.js";

// Estudiantes del módulo administrativo (solo lectura).

const childrenQuery = z.strictObject({
  /** Id del estado en el catálogo de Saga. */
  statusId: z.string().trim().min(1).max(50).exactOptional(),
  search: searchQuery.exactOptional(),
});
const documentParams = z.object({ documentNumber: z.string().trim().min(1).max(30) });

export function createChildrenRouter({ children, access }: { children: ChildrenService; access: AccessPolicy }): Router {
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
    const { id } = readParams(idParams, req);
    await access.assertCanReadStudent(principalOf(res), id);
    res.json(await children.get(id));
  });
  router.get("/children/:id/guardians", async (req, res) => {
    const { activeOnly } = readQuery(activeOnlyQuery, req);
    const { id } = readParams(idParams, req);
    await access.assertCanReadStudent(principalOf(res), id);
    res.json(await children.getGuardians(id, activeOnly ?? true));
  });

  return router;
}
