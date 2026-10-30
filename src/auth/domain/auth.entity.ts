// Autenticación delegada al módulo administrativo (ADR-003).
// Las cuentas, roles y sesiones son suyos: este módulo no los guarda, solo
// remite las peticiones del front y devuelve lo que necesita de la respuesta.
// Estos DTOs son la forma propia del módulo; el adaptador traduce desde/hacia
// el formato del servicio administrativo (que puede variar).

/** Registro público de un usuario. `role`: código del catálogo administrativo (p. ej. `ACUDIENTE`, `DONANTE`). */
export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
  role: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Usuario autenticado, solo con lo que usa este módulo. Lo que el servicio no envíe queda en `null`. */
export interface AuthUser {
  id: string | null;
  username: string | null;
  email: string | null;
  /** Códigos de rol en mayúsculas, como los define el módulo administrativo. */
  roles: string[];
}

/** Sesión iniciada: el front envía `token` en `Authorization: Bearer <token>`. */
export interface AuthSession {
  token: string;
  tokenType: "Bearer";
  /** Segundos de vigencia, si el servicio los informa. */
  expiresIn: number | null;
  user: AuthUser | null;
}

/** Resultado del registro: el usuario creado y, si el servicio ya abre sesión, la sesión. */
export interface RegistrationResult {
  message: string | null;
  user: AuthUser | null;
  session: AuthSession | null;
}
