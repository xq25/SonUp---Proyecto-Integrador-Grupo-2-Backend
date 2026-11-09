import { jwtVerify } from "jose";
import { ExternalServiceError, UnauthorizedError } from "../../shared/domain/errors.js";
import type { Principal } from "../domain/principal.entity.js";
import type { TokenVerifier } from "../domain/token-verifier.js";

// Verificación local del JWT del servicio de seguridad (ADR-008), según su
// contrato común a todos los backends del proyecto:
// - HS256 con el secreto compartido `JWT_SECRET` (el mismo en el emisor y en
//   cada backend consumidor). Nunca se registra en logs.
// - Se verifica la firma (no solo se decodifica), `exp` y, si viene, `nbf`.
// - `sub` (texto, id estable del usuario) y `roles` (lista de textos) deben
//   tener esos tipos; si no, el token se rechaza (401).
// No se consulta el servidor de seguridad en cada petición.

/** Secreto compartido (`JWT_SECRET`), o null si no está configurado. */
export function jwtSecretFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env["JWT_SECRET"];
  return secret && secret.trim() !== "" ? secret : null;
}

const invalid = () => new UnauthorizedError("Token inválido o vencido: inicia sesión de nuevo");

export class JwtTokenVerifier implements TokenVerifier {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<Principal> {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"] }));
    } catch {
      throw invalid();
    }
    const { sub, roles, exp } = payload;
    if (typeof sub !== "string" || sub.trim() === "") throw invalid();
    if (!Array.isArray(roles) || !roles.every((role) => typeof role === "string")) throw invalid();
    return {
      userId: sub.trim(),
      roles: [...new Set(roles.map((role) => role.trim().toUpperCase()).filter(Boolean))],
      links: {},
      ...(typeof exp === "number" ? { expiresAt: new Date(exp * 1000) } : {}),
    };
  }
}

/**
 * Sin `JWT_SECRET` (solo fuera de producción): la API arranca para probar con
 * las cabeceras de desarrollo, pero todo token se rechaza con un error de
 * configuración (503), nunca se acepta sin verificar.
 */
export class UnconfiguredTokenVerifier implements TokenVerifier {
  async verify(): Promise<Principal> {
    throw new ExternalServiceError("La verificación de tokens no está configurada (falta JWT_SECRET)", "not_configured");
  }
}
