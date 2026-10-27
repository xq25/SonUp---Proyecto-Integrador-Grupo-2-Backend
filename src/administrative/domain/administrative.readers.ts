import type {
  Child,
  ChildFilter,
  ChildGuardianWithChild,
  ChildGuardianWithGuardian,
  Guardian,
  GuardianFilter,
  Professional,
  ProfessionalFilter,
} from "./administrative.entity.js";

// Puertos de solo lectura hacia los datos del módulo administrativo.
// Se llaman *Reader (no *Repository) porque este módulo nunca escribe en ellos.

export interface ChildReader {
  findById(id: bigint): Promise<Child | null>;
  findByDocumentNumber(documentNumber: string): Promise<Child | null>;
  findMany(filter?: ChildFilter): Promise<Child[]>;
}

export interface GuardianReader {
  findById(id: bigint): Promise<Guardian | null>;
  findMany(filter?: GuardianFilter): Promise<Guardian[]>;
  /** Acudientes de un joven. Con `activeOnly`, solo vínculos sin `endDate`. */
  findByChild(childId: bigint, activeOnly?: boolean): Promise<ChildGuardianWithGuardian[]>;
  /** Jóvenes de un acudiente. Con `activeOnly`, solo vínculos sin `endDate`. */
  findChildrenOf(guardianId: bigint, activeOnly?: boolean): Promise<ChildGuardianWithChild[]>;
}

export interface ProfessionalReader {
  findById(id: bigint): Promise<Professional | null>;
  findByStaffId(staffId: bigint): Promise<Professional | null>;
  findMany(filter?: ProfessionalFilter): Promise<Professional[]>;
}
