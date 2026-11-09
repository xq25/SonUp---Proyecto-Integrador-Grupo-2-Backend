import { ExternalServiceError, ForbiddenError, UnauthorizedError } from "../../../shared/domain/errors.js";

// Cliente HTTP hacia la API de Saga (módulo administrativo), ADR-007. Solo GET:
// este módulo nunca escribe en Saga. Envía el token del usuario de la petición
// (ADR-008) o, fuera de una petición, el del usuario de servicio; este último se
// renueva una vez si Saga lo rechaza.

export interface SagaConfig {
  /** URL base de la API de Saga (`SAGA_API_URL`). Sin ella se leen las tablas simuladas de la BD. */
  baseUrl: string | undefined;
  timeoutMs: number;
  credentials: { email: string; password: string } | undefined;
  /** Token ya emitido (`SAGA_SERVICE_TOKEN`), útil en pruebas: se usa mientras Saga lo acepte. */
  token: string | undefined;
}

/** Tiempo límite por defecto. Render (plan gratuito) tarda ~30 s en despertar: súbelo con SAGA_HTTP_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = 10_000;

export function sagaConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SagaConfig {
  const timeout = Number(env["SAGA_HTTP_TIMEOUT_MS"]);
  const email = env["SAGA_SERVICE_EMAIL"]?.trim();
  const password = env["SAGA_SERVICE_PASSWORD"];
  return {
    baseUrl: env["SAGA_API_URL"]?.trim() || undefined,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    credentials: email && password ? { email, password } : undefined,
    token: env["SAGA_SERVICE_TOKEN"]?.trim() || undefined,
  };
}

/** Token para Saga y de quién es: del usuario de la petición o del usuario de servicio. */
export interface SagaToken {
  value: string;
  fromUser: boolean;
}

/** De dónde sale el token. Con `forceRefresh` pide uno nuevo (solo posible con el usuario de servicio). */
export interface SagaTokenSource {
  getToken(forceRefresh?: boolean): Promise<SagaToken>;
}

const SERVICE = "El módulo administrativo (Saga)";

export class SagaHttpClient {
  constructor(
    private readonly config: SagaConfig,
    private readonly tokens: SagaTokenSource,
  ) {}

  /** Lista completa de un recurso (p. ej. `/children`). Saga no ofrece filtros: se filtra aquí. */
  async list(path: string): Promise<unknown[]> {
    const body = await this.get(path);
    if (!Array.isArray(body)) throw new ExternalServiceError(`${SERVICE} no devolvió una lista en ${path}`, "bad_response");
    return body;
  }

  /** Un registro por id (`/children/1`), o `null` si no existe. */
  async find(path: string): Promise<unknown | null> {
    return this.get(path, { notFoundAsNull: true });
  }

  private async get(path: string, { notFoundAsNull = false } = {}): Promise<unknown> {
    let token = await this.tokens.getToken();
    let response = await this.send(path, token.value);
    // Token vencido o revocado: se renueva una vez (el del usuario no se puede renovar: lanza 401).
    if (response.status === 401) {
      token = await this.tokens.getToken(true);
      response = await this.send(path, token.value);
    }

    if (response.ok) return readJson(response);
    if (response.status === 404 && notFoundAsNull) return null;
    const message = errorMessage(await readJson(response));
    if (token.fromUser && response.status === 401) {
      throw new UnauthorizedError(`${SERVICE} rechazó tu sesión: inicia sesión de nuevo${message}`);
    }
    if (token.fromUser && response.status === 403) {
      throw new ForbiddenError(`Tu rol no tiene acceso a esta información en el módulo administrativo${message}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ExternalServiceError(`${SERVICE} rechazó el acceso del usuario de servicio${message}`, "bad_response");
    }
    throw new ExternalServiceError(`${SERVICE} respondió ${response.status} en ${path}${message}`, "bad_response");
  }

  private async send(path: string, token: string): Promise<Response> {
    if (!this.config.baseUrl) {
      throw new ExternalServiceError("La conexión con el módulo administrativo no está configurada (SAGA_API_URL)", "not_configured");
    }
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    try {
      return await fetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ExternalServiceError(`${SERVICE} no respondió a tiempo`, "timeout");
      }
      throw new ExternalServiceError(`${SERVICE} no está disponible`, "unavailable");
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (raw === "") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ExternalServiceError(`${SERVICE} devolvió una respuesta que no es JSON`, "bad_response");
  }
}

/** Formato de error de Saga: `{ "error": "…" }`. */
const errorMessage = (body: unknown): string =>
  typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string"
    ? `: ${(body as { error: string }).error}`
    : "";
