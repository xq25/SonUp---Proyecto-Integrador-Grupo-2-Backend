// Autenticación delegada al módulo administrativo (ADR-003).
// Las cuentas, roles y sesiones son suyos: este módulo no los guarda, solo
// remite las peticiones del front y devuelve lo que necesita de la respuesta.
// Estos DTOs son la forma propia del módulo; el adaptador traduce desde/hacia
// el formato del servicio administrativo (que puede variar).

/** Usuario autenticado, solo con lo que usa este módulo. Lo que el servicio no envíe queda en `null`. */
export interface AuthUser {
  id: string | null;
  username: string | null;
  email: string | null;
  /** Códigos de rol en mayúsculas, como los define el módulo administrativo. */
  roles: string[];
}
