import type { ChildGuardianReader } from "../../administrative/domain/child-guardian.reader.js";
import { parseInput } from "../../shared/application/validation.js";
import { DomainError, UnauthorizedError } from "../../shared/domain/errors.js";
import type { ActorLinksResolver } from "../domain/actor-links.resolver.js";
import type { AuthSession, AuthSessionView, SessionDetails } from "../domain/auth-session.entity.js";
import type { AuthProfile, AuthUser } from "../domain/auth-user.entity.js";
import type { AuthGateway } from "../domain/auth.gateway.js";
import type { Principal } from "../domain/principal.entity.js";
import type { RegistrationResult } from "../domain/registration.entity.js";
import type { SagaIdentity } from "../domain/saga-identity.entity.js";
import type { TokenVerifier } from "../domain/token-verifier.js";
import { loginSchema } from "./auth-session.schemas.js";
import { registerUserSchema } from "./registration.schemas.js";

/** Lo necesario para describir la sesión: verificar el token y ubicar al usuario en Saga (ADR-008). */
export interface SessionIdentityDeps {
  tokens: TokenVerifier;
  links: ActorLinksResolver;
  childGuardians: ChildGuardianReader;
}

const NO_DETAILS = { principal: null, expiresAt: null, saga: null } as const;

/**
 * Autenticación del front a través de este módulo (ADR-003): valida la forma
 * de la entrada, la remite al módulo administrativo por el puerto
 * `AuthGateway` y devuelve nuestros DTOs. No guarda cuentas ni sesiones.
 *
 * Al login y al perfil les agrega (ADR-008) el vencimiento del token y los ids
 * de Saga del usuario según su rol, para que el front sepa con qué consultar
 * "lo suyo". Es de mejor esfuerzo: si el token no se puede verificar o Saga no
 * responde, el login no falla; `saga` llega en `null`.
 */
export class AuthService {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly identity?: SessionIdentityDeps,
  ) {}

  register(data: unknown): Promise<RegistrationResult> {
    return this.gateway.register(parseInput(registerUserSchema, data, "Registro"));
  }

  /** Inicia sesión en el servicio de seguridad. Para la respuesta al front, ver `describeSession`. */
  login(data: unknown): Promise<AuthSession> {
    return this.gateway.login(parseInput(loginSchema, data, "Inicio de sesión"));
  }

  /**
   * Completa la sesión con `expiresAt` y `saga`. `user.id` y `user.roles` se
   * toman del token verificado, aunque el servicio de seguridad no los envíe.
   * Debe correr con el token de la sesión en el contexto de la petición, para
   * consultar Saga como ese usuario.
   */
  async describeSession(session: AuthSession): Promise<AuthSessionView> {
    const details = await this.detailsOf(session.token);
    return {
      ...session,
      user: mergeUser(session.user, details.principal),
      expiresAt: details.expiresAt,
      saga: details.saga,
    };
  }

  async getProfile(token: string | undefined): Promise<AuthProfile> {
    if (!token) throw new UnauthorizedError("Token requerido: envía 'Authorization: Bearer <token>'");
    const user = await this.gateway.getProfile(token);
    const details = await this.detailsOf(token);
    return { ...mergeUser(user, details.principal)!, expiresAt: details.expiresAt, saga: details.saga };
  }

  private async detailsOf(token: string): Promise<SessionDetails & { principal: Principal | null }> {
    if (!this.identity) return NO_DETAILS;
    let principal: Principal;
    try {
      principal = await this.identity.tokens.verify(token);
    } catch (error) {
      if (error instanceof DomainError) return NO_DETAILS;
      throw error;
    }
    const expiresAt = principal.expiresAt ?? null;
    try {
      return { principal, expiresAt, saga: await this.sagaIdentityOf(principal) };
    } catch (error) {
      // Saga caída o que rechaza la consulta: la sesión sigue siendo válida.
      if (error instanceof DomainError) return { principal, expiresAt, saga: null };
      throw error;
    }
  }

  private async sagaIdentityOf(principal: Principal): Promise<SagaIdentity> {
    const links = await this.identity!.links.resolve(principal);
    const childIds =
      links.guardianId === undefined
        ? []
        : (await this.identity!.childGuardians.findByGuardian(links.guardianId, true)).map((link) => link.childId);
    return {
      linked: [links.professionalId, links.staffId, links.childId, links.guardianId].some((id) => id !== undefined),
      professionalId: links.professionalId ?? null,
      staffId: links.staffId ?? null,
      childId: links.childId ?? null,
      guardianId: links.guardianId ?? null,
      childIds,
    };
  }
}

/** El usuario del servicio de seguridad, con `id` y `roles` del token verificado si los hay. */
function mergeUser(user: AuthUser | null, principal: Principal | null): AuthUser | null {
  if (!principal) return user;
  return {
    id: principal.userId,
    username: user?.username ?? null,
    email: user?.email ?? null,
    roles: principal.roles,
  };
}
