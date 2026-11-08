import { jwtVerify } from "jose";
import { UnauthorizedError } from "../../shared/domain/errors.js";
import { linksFromClaims } from "../domain/actor-links.js";
import type { Principal } from "../domain/principal.entity.js";
import type { TokenVerifier } from "../domain/token-verifier.js";

// Verificación local del JWT del servicio de seguridad (ADR-008): firma HS256
// con el secreto compartido, vencimiento y, si se configuran, emisor y audiencia.
// Formato observado: { "roles": ["ADMIN"], "sub": "20", "iat": …, "exp": … }.
// Si trae el id del usuario en Saga (professionalId, childId, guardianId), se usa para "lo suyo".

export interface JwtVerifierConfig {
  secret: string;
  issuer: string | undefined;
  audience: string | undefined;
}

/** `null` si no hay `AUTH_JWT_SECRET`: entonces se usa el endpoint de perfil. */
export function jwtVerifierConfigFromEnv(env: NodeJS.ProcessEnv = process.env): JwtVerifierConfig | null {
  const secret = env["AUTH_JWT_SECRET"];
  if (!secret) return null;
  return {
    secret,
    issuer: env["AUTH_JWT_ISSUER"]?.trim() || undefined,
    audience: env["AUTH_JWT_AUDIENCE"]?.trim() || undefined,
  };
}

/** Roles del token: `roles` (lista) o `role`/`rol` (texto), en mayúsculas y sin repetir. */
export const rolesFromClaims = (claims: Record<string, unknown>): string[] => {
  const value = claims["roles"] ?? claims["role"] ?? claims["rol"];
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return [...new Set(list.filter((role): role is string => typeof role === "string" && role.trim() !== "").map((role) => role.trim().toUpperCase()))];
};

export class JwtTokenVerifier implements TokenVerifier {
  private readonly key: Uint8Array;

  constructor(private readonly config: JwtVerifierConfig) {
    this.key = new TextEncoder().encode(config.secret);
  }

  async verify(token: string): Promise<Principal> {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        ...(this.config.issuer ? { issuer: this.config.issuer } : {}),
        ...(this.config.audience ? { audience: this.config.audience } : {}),
      }));
    } catch {
      throw new UnauthorizedError("Token inválido o vencido: inicia sesión de nuevo");
    }
    const sub = payload["sub"];
    const userId = typeof sub === "string" || typeof sub === "number" ? String(sub) : "";
    if (userId === "") throw new UnauthorizedError("El token no identifica al usuario (sub)");
    return { userId, roles: rolesFromClaims(payload), links: linksFromClaims(payload) };
  }
}
