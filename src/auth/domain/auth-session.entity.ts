import type { AuthUser } from "./auth-user.entity.js";
import type { SagaIdentity } from "./saga-identity.entity.js";

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

/** Lo que este módulo agrega a la sesión y al perfil (ADR-008). */
export interface SessionDetails {
  /** Vencimiento del token (`exp`). */
  expiresAt: Date | null;
  /** Ids de Saga según el rol; `null` si no se pudo consultar Saga (reintentar con GET /auth/profile). */
  saga: SagaIdentity | null;
}

/** Respuesta de POST /auth/login. `user.id` y `user.roles` salen del token verificado. */
export interface AuthSessionView extends AuthSession, SessionDetails {}
