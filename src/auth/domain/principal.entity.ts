// Quién hace una petición (ADR-008): el usuario del servicio de seguridad, según su token.

/**
 * A quién del módulo administrativo (Saga) corresponde el usuario. El rol dice
 * qué tipo de usuario es; estos ids dicen cuál, para limitarlo a "lo suyo".
 * Provisional: el servicio de seguridad debe confirmar cómo los envía en el token.
 */
export interface ActorLinks {
  /** `professional_id` del tallerista. */
  professionalId?: bigint;
  /** `staff_id` del tallerista. */
  staffId?: bigint;
  /** `child_id` del joven. */
  childId?: bigint;
  /** `guardian_id` del acudiente. */
  guardianId?: bigint;
}

export interface Principal {
  /** Id del usuario en el servicio de seguridad (claim `sub`). Es el `actor` que queda en la auditoría. */
  userId: string;
  /** Códigos de rol en mayúsculas (`ADMIN`, `TALLERISTA`, `ESTUDIANTE`, `ACUDIENTE`, `DONANTE`). */
  roles: string[];
  links: ActorLinks;
  /** Vencimiento del token (`exp`), si se conoce. */
  expiresAt?: Date;
}
