import type { ActorLinks, Principal } from "./principal.entity.js";

/**
 * Puerto: a quién del módulo administrativo (Saga) corresponde el usuario del
 * token (ADR-008 §2.6). Saga guarda el `sub` en `security_user_id` cuando el
 * usuario se registra o enlaza (POST /staff|children|guardians/register).
 */
export interface ActorLinksResolver {
  resolve(principal: Principal): Promise<ActorLinks>;
}
