import type { ChildGuardianWithChild, ChildGuardianWithGuardian } from "./child-guardian.entity.js";

/** Solo lectura: este módulo nunca escribe en las tablas del módulo administrativo. */
export interface ChildGuardianReader {
  /** Acudientes de un joven. Con `activeOnly`, solo vínculos sin `endDate`. */
  findByChild(childId: bigint, activeOnly?: boolean): Promise<ChildGuardianWithGuardian[]>;
  /** Jóvenes de un acudiente. Con `activeOnly`, solo vínculos sin `endDate`. */
  findByGuardian(guardianId: bigint, activeOnly?: boolean): Promise<ChildGuardianWithChild[]>;
}
