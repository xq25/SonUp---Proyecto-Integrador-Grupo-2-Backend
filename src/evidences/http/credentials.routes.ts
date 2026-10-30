import { Router } from "express";
import { actorOf, idParams, readParams, studentParams } from "../../shared/http/request.js";
import type { CredentialsService } from "../application/credentials.service.js";

// Credenciales y certificados de los estudiantes.

export function createCredentialsRouter({ credentials }: { credentials: CredentialsService }): Router {
  const router = Router();

  router.post("/credentials", async (req, res) => {
    res.status(201).json(await credentials.register(req.body, actorOf(res)));
  });
  router.get("/credentials/:id", async (req, res) => {
    res.json(await credentials.get(readParams(idParams, req).id));
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
    res.json(await credentials.listByStudent(readParams(studentParams, req).studentId));
  });

  return router;
}
