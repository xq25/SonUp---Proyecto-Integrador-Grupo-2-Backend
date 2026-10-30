import type { AuthSession, LoginInput } from "./auth-session.entity.js";
import type { AuthUser } from "./auth-user.entity.js";
import type { RegisterUserInput, RegistrationResult } from "./registration.entity.js";

/**
 * Puerto hacia el servicio de autenticación del módulo administrativo.
 * La implementación habla con su API (hoy en Render); el servicio de
 * aplicación solo conoce esta interfaz, así que cambiar de proveedor o usar
 * un doble de prueba es cambiar el adaptador en `src/container.ts`.
 *
 * Errores esperados (de dominio): ValidationError (datos rechazados),
 * UnauthorizedError (credenciales o sesión inválidas), ConflictError
 * (usuario ya existe) y ExternalServiceError (servicio caído, lento o con
 * respuesta inesperada).
 */
export interface AuthGateway {
  register(input: RegisterUserInput): Promise<RegistrationResult>;
  login(input: LoginInput): Promise<AuthSession>;
  /** Usuario dueño del token. */
  getProfile(token: string): Promise<AuthUser>;
}
