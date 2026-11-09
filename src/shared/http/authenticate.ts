import type { RequestHandler } from "express";
import { linksFromClaims } from "../../auth/domain/actor-links.js";
import type { Principal } from "../../auth/domain/principal.entity.js";
import type { TokenVerifier } from "../../auth/domain/token-verifier.js";
import { UnauthorizedError } from "../domain/errors.js";
import { runWithRequestContext } from "../infrastructure/request-context.js";

// Obtiene quién hace cada petición (ADR-008):
// - `Authorization: Bearer <token del servicio de seguridad>`: siempre. Se
//   verifica localmente con el `TokenVerifier` (`JWT_SECRET`); el actor
//   es su `sub` y sus roles deciden el acceso (`authorize`). El token queda en
//   el contexto de la petición para reenviarlo a Saga.
// - `X-Actor-Id` (+ `X-Actor-Roles`): solo fuera de producción, para pruebas
//   manuales. Sin `X-Actor-Roles` se asume `ADMIN`. A quién de Saga corresponde
//   (para "lo suyo"): `X-Actor-Professional-Id`, `X-Actor-Child-Id`, `X-Actor-Guardian-Id`.

export interface AuthOptions {
  /** Permite las cabeceras `X-Actor-Id`/`X-Actor-Roles`. Nunca en producción. */
  allowDevHeader: boolean;
}

export function authOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthOptions {
  return { allowDevHeader: env["NODE_ENV"] !== "production" };
}

/** Rol que se asume en desarrollo si `X-Actor-Roles` no viene. */
const DEV_DEFAULT_ROLES = ["ADMIN"];

function devPrincipal(actorHeader: string, rolesHeader: string | undefined, linkHeaders: Record<string, unknown>): Principal {
  const userId = actorHeader.trim();
  if (!/^[\w-]{1,64}$/.test(userId)) {
    throw new UnauthorizedError("X-Actor-Id debe ser el id del usuario (letras, números, _ o -, máx. 64)");
  }
  const roles =
    rolesHeader === undefined
      ? DEV_DEFAULT_ROLES
      : [...new Set(rolesHeader.split(",").map((role) => role.trim().toUpperCase()).filter(Boolean))];
  return { userId, roles, links: linksFromClaims(linkHeaders) };
}

export function authenticate(verifier: TokenVerifier, options: AuthOptions): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.get("authorization");
    const devActor = req.get("x-actor-id");
    let principal: Principal;
    let token: string | undefined;

    if (authorization) {
      const [scheme, value] = authorization.split(" ");
      if (scheme?.toLowerCase() !== "bearer" || !value) {
        throw new UnauthorizedError("La cabecera Authorization debe ser 'Bearer <token>'");
      }
      token = value;
      principal = await verifier.verify(token);
    } else if (devActor !== undefined) {
      if (!options.allowDevHeader) throw new UnauthorizedError("La cabecera X-Actor-Id no se acepta en producción");
      principal = devPrincipal(devActor, req.get("x-actor-roles"), {
        professionalId: req.get("x-actor-professional-id"),
        staffId: req.get("x-actor-staff-id"),
        childId: req.get("x-actor-child-id"),
        guardianId: req.get("x-actor-guardian-id"),
      });
    } else {
      throw new UnauthorizedError("Falta autenticación: envía 'Authorization: Bearer <token>'");
    }

    res.locals["actor"] = principal.userId;
    res.locals["roles"] = principal.roles;
    res.locals["principal"] = principal;
    // El resto de la petición (rutas, servicios y lectores) corre dentro de este contexto.
    runWithRequestContext({ token }, () => next());
  };
}
