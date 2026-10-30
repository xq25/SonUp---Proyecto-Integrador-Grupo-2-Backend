import { NotFoundError } from "../../shared/domain/errors.js";
import type { Professional, ProfessionalFilter } from "../domain/professional.entity.js";
import type { ProfessionalReader } from "../domain/professional.reader.js";

/** Consulta de talleristas del módulo administrativo (solo lectura). */
export class ProfessionalsService {
  constructor(private readonly professionals: ProfessionalReader) {}

  async get(id: bigint): Promise<Professional> {
    const professional = await this.professionals.findById(id);
    if (!professional) throw new NotFoundError("Tallerista", id);
    return professional;
  }

  findByStaffId(staffId: bigint): Promise<Professional | null> {
    return this.professionals.findByStaffId(staffId);
  }

  list(filter?: ProfessionalFilter): Promise<Professional[]> {
    return this.professionals.findMany(filter);
  }
}
