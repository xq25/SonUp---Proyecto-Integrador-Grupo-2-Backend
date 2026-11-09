import { Router } from "express";
import type { AccessPolicy } from "../../auth/application/access-policy.js";
import { actorOf, idParams, principalOf, readParams, studentParams } from "../../shared/http/request.js";
import type { CredentialsService } from "../application/credentials.service.js";

// Credenciales y certificados de los estudiantes.

export function createCredentialsRouter({ credentials, access }: { credentials: CredentialsService; access: AccessPolicy }): Router {
  const router = Router();

  router.post("/credentials", async (req, res) => {
    res.status(201).json(await credentials.register(req.body, actorOf(res)));
  });
  router.get("/credentials/:id", async (req, res) => {
    const { id } = readParams(idParams, req);
    await access.assertCanReadCredential(principalOf(res), id);
    res.json(await credentials.get(id));
  });
  /** Edita datos (solo `pending`) o cambia el estado (pending → valid → revoked). */
  router.patch("/credentials/:id", async (req, res) => {
    res.json(await credentials.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/credentials/:id", async (req, res) => {
    await credentials.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });
  router.get("/students/:studentId/credentials", async (req, res) => {
    const { studentId } = readParams(studentParams, req);
    await access.assertCanReadStudent(principalOf(res), studentId);
    res.json(await credentials.listByStudent(studentId));
  });

  return router;
}
