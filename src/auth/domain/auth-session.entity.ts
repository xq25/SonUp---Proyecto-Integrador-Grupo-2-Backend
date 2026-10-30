import type { AuthUser } from "./auth-user.entity.js";

// Sesión del módulo administrativo (ADR-003): no se guarda aquí, solo se remite.

export interface LoginInput {
  email: string;
  password: string;
}

/** Sesión iniciada: el front envía `token` en `Authorization: Bearer <token>`. */
export interface AuthSession {
  token: string;
  tokenType: "Bearer";
  /** Segundos de vigencia, si el servicio los informa. */
  expiresIn: number | null;
  user: AuthUser | null;
}
