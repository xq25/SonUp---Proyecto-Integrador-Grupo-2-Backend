import type { Guardian, GuardianFilter } from "./guardian.entity.js";

/** Solo lectura: este módulo nunca escribe en las tablas del módulo administrativo. */
export interface GuardianReader {
  findById(id: bigint): Promise<Guardian | null>;
  findMany(filter?: GuardianFilter): Promise<Guardian[]>;
}
