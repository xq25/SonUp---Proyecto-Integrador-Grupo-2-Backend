import type { Child, ChildFilter } from "./child.entity.js";

// Puertos de solo lectura hacia los datos del módulo administrativo.
// Se llaman *Reader (no *Repository) porque este módulo nunca escribe en ellos.

export interface ChildReader {
  findById(id: bigint): Promise<Child | null>;
  findByDocumentNumber(documentNumber: string): Promise<Child | null>;
  findMany(filter?: ChildFilter): Promise<Child[]>;
  /** Joven enlazado a la cuenta del servicio de seguridad (`sub` del token), o null. */
  findBySecurityUserId(securityUserId: string): Promise<Child | null>;
}
