import type { Professional, ProfessionalFilter } from "./professional.entity.js";

/** Solo lectura: este módulo nunca escribe en las tablas del módulo administrativo. */
export interface ProfessionalReader {
  findById(id: bigint): Promise<Professional | null>;
  findByStaffId(staffId: bigint): Promise<Professional | null>;
  findMany(filter?: ProfessionalFilter): Promise<Professional[]>;
}
