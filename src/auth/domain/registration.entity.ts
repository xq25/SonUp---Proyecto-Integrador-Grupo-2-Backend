import type { AuthSession } from "./auth-session.entity.js";
import type { AuthUser } from "./auth-user.entity.js";

// Registro en el módulo administrativo (ADR-003): la cuenta se crea allá.

/** Registro público de un usuario. `role`: código del catálogo administrativo (p. ej. `ACUDIENTE`, `DONANTE`). */
export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
  role: string;
}

/** Resultado del registro: el usuario creado y, si el servicio ya abre sesión, la sesión. */
export interface RegistrationResult {
  message: string | null;
  user: AuthUser | null;
  session: AuthSession | null;
}
