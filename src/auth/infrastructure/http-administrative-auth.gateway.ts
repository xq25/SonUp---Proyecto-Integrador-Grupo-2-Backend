import {
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../shared/domain/errors.js";
import type { AuthSession, AuthUser, LoginInput, RegisterUserInput, RegistrationResult } from "../domain/auth.entity.js";
import type { AuthGateway } from "../domain/auth.gateway.js";
import {
  toAuthSession,
  toAuthUser,
  toErrorMessage,
  toFieldIssues,
  toLoginRequest,
  toRegisterRequest,
  toRegistrationResult,
} from "./administrative-auth.mapper.js";

// Adaptador HTTP hacia el servicio de autenticación del módulo administrativo (ADR-003).
// Solo transporta: arma la petición, la envía con tiempo límite y traduce el
// resultado (con el mapeador) a DTOs o errores de dominio. Usa `fetch` de Node.

export interface AdministrativeAuthConfig {
  /** URL base del servicio (`RENDER_API_URL`). Sin ella, cada llamada responde 503. */
  baseUrl: string | undefined;
  registerPath: string;
  loginPath: string;
  profilePath: string;
  timeoutMs: number;
}

/** Tiempo límite por defecto. Render (plan gratuito) tarda ~30 s en despertar: súbelo con RENDER_HTTP_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = 10_000;

export function administrativeAuthConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AdministrativeAuthConfig {
  const timeout = Number(env["RENDER_HTTP_TIMEOUT_MS"]);
  return {
    baseUrl: env["RENDER_API_URL"]?.trim() || undefined,
    registerPath: env["RENDER_REGISTER_PATH"] ?? "/auth/registro",
    loginPath: env["RENDER_LOGIN_PATH"] ?? "/auth/login",
    profilePath: env["RENDER_PROFILE_PATH"] ?? "/auth/perfil",
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

const SERVICE = "El servicio de autenticación del módulo administrativo";

export class HttpAdministrativeAuthGateway implements AuthGateway {
  constructor(private readonly config: AdministrativeAuthConfig) {}

  async register(input: RegisterUserInput): Promise<RegistrationResult> {
    const body = await this.send("POST", this.config.registerPath, { body: toRegisterRequest(input) });
    return toRegistrationResult(body);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const body = await this.send("POST", this.config.loginPath, { body: toLoginRequest(input) });
    const session = toAuthSession(body);
    if (!session) throw new ExternalServiceError(`${SERVICE} no devolvió un token de sesión`, "bad_response");
    return session;
  }

  async getProfile(token: string): Promise<AuthUser> {
    const body = await this.send("GET", this.config.profilePath, { token });
    const user = toAuthUser(body);
    if (!user) throw new ExternalServiceError(`${SERVICE} no devolvió los datos del usuario`, "bad_response");
    return user;
  }

  /** Envía la petición y devuelve el cuerpo de la respuesta 2xx; cualquier otra se traduce a un error de dominio. */
  private async send(
    method: "GET" | "POST",
    path: string,
    { body, token }: { body?: unknown; token?: string },
  ): Promise<unknown> {
    if (!this.config.baseUrl) {
      throw new ExternalServiceError("La autenticación no está configurada (RENDER_API_URL)", "not_configured");
    }
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token !== undefined) headers["Authorization"] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ExternalServiceError(`${SERVICE} no respondió a tiempo`, "timeout");
      }
      throw new ExternalServiceError(`${SERVICE} no está disponible`, "unavailable");
    }

    const parsed = await readJson(response);
    if (response.ok) return parsed;
    throw toDomainError(response.status, parsed);
  }
}

/** Cuerpo JSON de la respuesta, o `undefined` si no es JSON. */
async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (raw === "") return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Respuesta de error del servicio → error de dominio, conservando su mensaje y detalles. */
function toDomainError(status: number, body: unknown): Error {
  const message = toErrorMessage(body);
  switch (status) {
    case 400:
    case 422:
      return new ValidationError(message ?? "Datos inválidos", toFieldIssues(body));
    case 401:
      return new UnauthorizedError(message ?? "Credenciales o sesión inválidas");
    case 403:
      return new ForbiddenError(message ?? "Acceso denegado");
    case 409:
      return new ConflictError(message ?? "El usuario ya existe");
    case 429:
      return new ExternalServiceError(message ?? "Demasiados intentos; inténtalo más tarde", "rate_limited");
    default:
      // 404 (ruta mal configurada), 5xx u otros: el problema es del servicio, no del front.
      return new ExternalServiceError(`${SERVICE} respondió ${status}${message ? `: ${message}` : ""}`, "bad_response");
  }
}
