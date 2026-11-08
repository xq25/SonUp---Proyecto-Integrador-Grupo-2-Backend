import type { Principal } from "./principal.entity.js";

/**
 * Puerto para verificar el token del servicio de seguridad y obtener el
 * usuario y sus roles (ADR-008). Dos adaptadores, elegidos por `.env` en
 * `src/container.ts`: verificación local del JWT (con el secreto) o consulta
 * al endpoint de perfil del servicio.
 *
 * Lanza UnauthorizedError si el token es inválido o venció.
 */
export interface TokenVerifier {
  verify(token: string): Promise<Principal>;
}
