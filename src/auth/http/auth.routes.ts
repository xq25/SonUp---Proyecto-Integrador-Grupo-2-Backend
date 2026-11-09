import { type Request, Router } from "express";
import { runWithRequestContext } from "../../shared/infrastructure/request-context.js";
import type { AuthService } from "../application/auth.service.js";

// Autenticación (ADR-003). Rutas públicas: se montan antes de `authenticate`.
// Remiten al módulo administrativo y devuelven su respuesta como DTOs propios.
// El login y el perfil se completan con los ids de Saga del usuario (ADR-008):
// se consultan con el token de la sesión, puesto en el contexto de la petición.

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
    const session = await auth.login(req.body);
    res.json(await runWithRequestContext({ token: session.token }, () => auth.describeSession(session)));
  });
  router.get("/auth/profile", async (req, res) => {
    const token = bearerTokenOf(req);
    res.json(await runWithRequestContext({ token }, () => auth.getProfile(token)));
  });

  return router;
}
