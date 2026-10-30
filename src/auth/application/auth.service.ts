import { parseInput } from "../../shared/application/validation.js";
import { UnauthorizedError } from "../../shared/domain/errors.js";
import type { AuthSession } from "../domain/auth-session.entity.js";
import type { AuthUser } from "../domain/auth-user.entity.js";
import type { AuthGateway } from "../domain/auth.gateway.js";
import type { RegistrationResult } from "../domain/registration.entity.js";
import { loginSchema } from "./auth-session.schemas.js";
import { registerUserSchema } from "./registration.schemas.js";

/**
 * Autenticación del front a través de este módulo (ADR-003): valida la forma
 * de la entrada, la remite al módulo administrativo por el puerto
 * `AuthGateway` y devuelve nuestros DTOs. No guarda cuentas ni sesiones.
 */
export class AuthService {
  constructor(private readonly gateway: AuthGateway) {}

  register(data: unknown): Promise<RegistrationResult> {
    return this.gateway.register(parseInput(registerUserSchema, data, "Registro"));
  }

  login(data: unknown): Promise<AuthSession> {
    return this.gateway.login(parseInput(loginSchema, data, "Inicio de sesión"));
  }

  async getProfile(token: string | undefined): Promise<AuthUser> {
    if (!token) throw new UnauthorizedError("Token requerido: envía 'Authorization: Bearer <token>'");
    return this.gateway.getProfile(token);
  }
}
