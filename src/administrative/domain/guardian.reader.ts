import type { Guardian, GuardianFilter } from "./guardian.entity.js";

/** Solo lectura: este módulo nunca escribe en las tablas del módulo administrativo. */
export interface GuardianReader {
  findById(id: bigint): Promise<Guardian | null>;
  findMany(filter?: GuardianFilter): Promise<Guardian[]>;
  /** Acudiente enlazado a la cuenta del servicio de seguridad (`sub` del token), o null. */
  findBySecurityUserId(securityUserId: string): Promise<Guardian | null>;
}
