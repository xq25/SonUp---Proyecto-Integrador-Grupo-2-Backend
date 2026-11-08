import { ExternalServiceError } from "../../shared/domain/errors.js";
import type { AuthGateway } from "../domain/auth.gateway.js";
import type { Principal } from "../domain/principal.entity.js";
import type { TokenVerifier } from "../domain/token-verifier.js";

// Verificación remota (ADR-008): sin el secreto del JWT, se pregunta al servicio
// de seguridad (endpoint de perfil) quién es el usuario del token y qué roles
// tiene. El resultado se guarda unos segundos para no consultarlo en cada petición.

/** Segundos que se reutiliza la respuesta del perfil (`AUTH_PROFILE_CACHE_SECONDS`). */
export function profileCacheSecondsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const seconds = Number(env["AUTH_PROFILE_CACHE_SECONDS"]);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : 60;
}

/** Tope de tokens en caché: al superarlo se descartan los vencidos (o todo, si no basta). */
const MAX_CACHED = 1000;

export class RemoteTokenVerifier implements TokenVerifier {
  private readonly cache = new Map<string, { principal: Principal; until: number }>();

  constructor(
    private readonly gateway: AuthGateway,
    private readonly cacheSeconds: number,
  ) {}

  async verify(token: string): Promise<Principal> {
    const now = Date.now();
    const cached = this.cache.get(token);
    if (cached && cached.until > now) return cached.principal;

    // Un token inválido o vencido llega como UnauthorizedError desde el gateway.
    const user = await this.gateway.getProfile(token);
    if (!user.id) {
      throw new ExternalServiceError("El servicio de seguridad no devolvió el id del usuario", "bad_response");
    }
    // El perfil aún no trae a quién de Saga corresponde: sin enlaces, "lo suyo" responde 403.
    const principal: Principal = { userId: user.id, roles: user.roles, links: {} };

    if (this.cacheSeconds > 0) {
      if (this.cache.size >= MAX_CACHED) this.prune(now);
      this.cache.set(token, { principal, until: now + this.cacheSeconds * 1000 });
    }
    return principal;
  }

  private prune(now: number) {
    for (const [token, entry] of this.cache) if (entry.until <= now) this.cache.delete(token);
    if (this.cache.size >= MAX_CACHED) this.cache.clear();
  }
}
