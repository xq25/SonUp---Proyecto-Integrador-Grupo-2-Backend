import { parseInput } from "../../shared/application/validation.js";
import { UnauthorizedError } from "../../shared/domain/errors.js";
import type { AuthSession, AuthUser, RegistrationResult } from "../domain/auth.entity.js";
import type { AuthGateway } from "../domain/auth.gateway.js";
import { loginSchema, registerUserSchema } from "./auth.schemas.js";

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
