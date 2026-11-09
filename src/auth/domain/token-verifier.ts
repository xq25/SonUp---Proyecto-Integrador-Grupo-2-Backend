import type { Principal } from "./principal.entity.js";

/**
 * Puerto: verifica el token del servicio de seguridad y devuelve quién es el
 * usuario (`sub`) y sus roles (ADR-008). La implementación verifica el JWT
 * localmente con el secreto compartido `JWT_SECRET`.
 */
export interface TokenVerifier {
  verify(token: string): Promise<Principal>;
}
