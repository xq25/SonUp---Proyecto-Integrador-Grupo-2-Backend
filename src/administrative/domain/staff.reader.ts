import type { Staff, StaffFilter } from "./staff.entity.js";

/** Solo lectura: este módulo nunca escribe en las tablas del módulo administrativo. */
export interface StaffReader {
  findById(id: bigint): Promise<Staff | null>;
  findMany(filter?: StaffFilter): Promise<Staff[]>;
}
