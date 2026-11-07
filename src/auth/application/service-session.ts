import { DomainError, ExternalServiceError } from "../../shared/domain/errors.js";
import type { AuthGateway } from "../domain/auth.gateway.js";

/** Usuario técnico de este módulo en el servicio de login (lo entrega el equipo de seguridad). */
export interface ServiceCredentials {
  email: string;
  password: string;
}

/** Margen para renovar el token antes de que venza. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Sesión del backend en el servicio de login (ADR-007): inicia sesión una vez
 * con el usuario de servicio y reutiliza el token en las llamadas a otros
 * módulos (p. ej. Saga). Lo renueva si vence o si el otro módulo lo rechaza
 * (`getToken(true)`). No depende de la sesión de ningún usuario del front.
 */
export class ServiceSession {
  private token: string | null = null;
  private expiresAt: number | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly gateway: AuthGateway,
    private readonly credentials: ServiceCredentials | undefined,
  ) {}

  async getToken(forceRefresh = false): Promise<string> {
    const valid = this.token !== null && (this.expiresAt === null || Date.now() < this.expiresAt);
    if (valid && !forceRefresh) return this.token!;
    // Varias peticiones a la vez comparten el mismo inicio de sesión.
    this.pending ??= this.login().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async login(): Promise<string> {
    if (!this.credentials) {
      throw new ExternalServiceError(
        "Falta el usuario de servicio para consultar el módulo administrativo (SAGA_SERVICE_EMAIL y SAGA_SERVICE_PASSWORD)",
        "not_configured",
      );
    }
    try {
      const session = await this.gateway.login(this.credentials);
      this.token = session.token;
      this.expiresAt = session.expiresIn ? Date.now() + session.expiresIn * 1000 - REFRESH_MARGIN_MS : null;
      return session.token;
    } catch (error) {
      this.token = null;
      if (error instanceof ExternalServiceError) throw error;
      // Credenciales rechazadas u otro error del login: el problema es de configuración, no del usuario del front.
      const detail = error instanceof DomainError ? `: ${error.message}` : "";
      throw new ExternalServiceError(`El usuario de servicio no pudo iniciar sesión${detail}`, "bad_response");
    }
  }
}
