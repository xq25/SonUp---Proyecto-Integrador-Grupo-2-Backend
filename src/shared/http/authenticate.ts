import type { RequestHandler } from "express";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { ProfilesService } from "../../profiles/application/profiles.service.js";
import { uuidSchema } from "../application/schemas.js";
import { NotFoundError } from "../domain/errors.js";
import { ForbiddenError, UnauthorizedError } from "./http-errors.js";

// Obtiene el `actor` de cada petición (ADR-002 §2.2):
// - `Authorization: Bearer <JWT de Supabase>`: siempre; el actor es el claim `sub`.
// - `X-Actor-Id: <uuid>`: solo fuera de producción, para pruebas manuales en Postman.
// En ambos casos el perfil debe existir, no estar eliminado y estar `activo`.

export interface AuthOptions {
  /** URL del proyecto de Supabase (`https://<ref>.supabase.co`): emisor y JWKS. */
  supabaseUrl?: string;
  /** Secreto compartido (HS256) para proyectos con las claves JWT antiguas. */
  jwtSecret?: string;
  /** Permite la cabecera `X-Actor-Id`. Nunca en producción. */
  allowDevHeader: boolean;
}

export function authOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthOptions {
  const supabaseUrl = env["SUPABASE_URL"]?.replace(/\/+$/, "");
  const jwtSecret = env["SUPABASE_JWT_SECRET"];
  return {
    ...(supabaseUrl ? { supabaseUrl } : {}),
    ...(jwtSecret ? { jwtSecret } : {}),
    allowDevHeader: env["NODE_ENV"] !== "production",
  };
}

/** Verifica un JWT de Supabase y devuelve su `sub` (id del perfil). */
type TokenVerifier = (token: string) => Promise<string>;

function createTokenVerifier(options: AuthOptions): TokenVerifier | null {
  if (!options.supabaseUrl) return null;
  const issuer = `${options.supabaseUrl}/auth/v1`;
  const secret = options.jwtSecret ? new TextEncoder().encode(options.jwtSecret) : null;
  const jwks: JWTVerifyGetKey | null = secret ? null : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const verifyOptions = { issuer, audience: "authenticated" };
      const { payload } = secret
        ? await jwtVerify(token, secret, verifyOptions)
        : await jwtVerify(token, jwks!, verifyOptions);
      if (!payload.sub) throw new Error("El token no trae sub");
      return payload.sub;
    } catch {
      throw new UnauthorizedError("Token inválido o vencido");
    }
  };
}

export function authenticate(profiles: ProfilesService, options: AuthOptions): RequestHandler {
  const verifyToken = createTokenVerifier(options);

  return async (req, res, next) => {
    const authorization = req.get("authorization");
    const devActor = req.get("x-actor-id");
    let actor: string;

    if (authorization) {
      const [scheme, token] = authorization.split(" ");
      if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw new UnauthorizedError("La cabecera Authorization debe ser 'Bearer <token>'");
      }
      if (!verifyToken) throw new UnauthorizedError("La autenticación por token no está configurada (SUPABASE_URL)");
      actor = await verifyToken(token);
    } else if (devActor !== undefined) {
      if (!options.allowDevHeader) throw new UnauthorizedError("La cabecera X-Actor-Id no se acepta en producción");
      const parsed = uuidSchema.safeParse(devActor);
      if (!parsed.success) throw new UnauthorizedError("X-Actor-Id debe ser el UUID de un perfil");
      actor = parsed.data;
    } else {
      throw new UnauthorizedError("Falta autenticación: envía 'Authorization: Bearer <token>'");
    }

    try {
      const profile = await profiles.get(actor);
      if (profile.status !== "activo") throw new ForbiddenError(`El perfil está ${profile.status}`);
    } catch (error) {
      if (error instanceof NotFoundError) throw new UnauthorizedError("El usuario autenticado no tiene perfil");
      throw error;
    }

    res.locals["actor"] = actor;
    next();
  };
}
