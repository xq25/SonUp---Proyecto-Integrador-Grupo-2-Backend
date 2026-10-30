import { type Request, Router } from "express";
import type { AuthService } from "../application/auth.service.js";

// Autenticación (ADR-003). Rutas públicas: se montan antes de `authenticate`.
// Remiten al módulo administrativo y devuelven su respuesta como DTOs propios.

/** Token de `Authorization: Bearer <token>`, o `undefined` si no viene. */
const bearerTokenOf = (req: Request): string | undefined => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  return match?.[1];
};

export function createAuthRouter({ auth }: { auth: AuthService }): Router {
  const router = Router();

  router.post("/auth/register", async (req, res) => {
    res.status(201).json(await auth.register(req.body));
  });
  router.post("/auth/login", async (req, res) => {
    res.json(await auth.login(req.body));
  });
  router.get("/auth/profile", async (req, res) => {
    res.json(await auth.getProfile(bearerTokenOf(req)));
  });

  return router;
}
