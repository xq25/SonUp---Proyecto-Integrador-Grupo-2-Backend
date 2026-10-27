import { Router } from "express";
import { z } from "zod";
import { idSchema } from "../../shared/application/schemas.js";
import { actorOf, idParams, readParams, studentParams } from "../../shared/http/request.js";
import type { CredentialsService } from "../application/credentials.service.js";
import type { EvidencesService } from "../application/evidences.service.js";

// Evidencias (con sus estudiantes) y credenciales.

const evidenceStudentParams = z.object({ id: idSchema, studentId: idSchema });

export function createEvidencesRouter({
  evidences,
  credentials,
}: {
  evidences: EvidencesService;
  credentials: CredentialsService;
}): Router {
  const router = Router();

  // ── Evidencias ──
  router.post("/evidences", async (req, res) => {
    res.status(201).json(await evidences.upload(req.body, actorOf(res)));
  });
  router.get("/evidences/:id", async (req, res) => {
    res.json(await evidences.get(readParams(idParams, req).id));
  });
  router.patch("/evidences/:id", async (req, res) => {
    res.json(await evidences.update(readParams(idParams, req).id, req.body, actorOf(res)));
  });
  router.delete("/evidences/:id", async (req, res) => {
    await evidences.delete(readParams(idParams, req).id, actorOf(res));
    res.status(204).end();
  });
  router.get("/evidences/:id/students", async (req, res) => {
    res.json(await evidences.listStudents(readParams(idParams, req).id));
  });
  /** Relaciona un estudiante (o restaura la relación eliminada). */
  router.put("/evidences/:id/students/:studentId", async (req, res) => {
    const { id, studentId } = readParams(evidenceStudentParams, req);
    res.json(await evidences.linkStudent(id, studentId, actorOf(res)));
  });
  router.delete("/evidences/:id/students/:studentId", async (req, res) => {
    const { id, studentId } = readParams(evidenceStudentParams, req);
    await evidences.unlinkStudent(id, studentId, actorOf(res));
    res.status(204).end();
  });
  router.get("/students/:studentId/evidences", async (req, res) => {
    res.json(await evidences.listByStudent(readParams(studentParams, req).studentId));
  });

  // ── Credenciales ──
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
