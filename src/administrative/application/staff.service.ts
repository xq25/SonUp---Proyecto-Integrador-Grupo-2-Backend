import { NotFoundError } from "../../shared/domain/errors.js";
import type { Staff, StaffFilter } from "../domain/staff.entity.js";
import type { StaffReader } from "../domain/staff.reader.js";

/** Consulta del personal (administrativos y talleristas) del módulo administrativo (solo lectura, ADR-006). */
export class StaffService {
  constructor(private readonly staff: StaffReader) {}

  async get(id: bigint): Promise<Staff> {
    const member = await this.staff.findById(id);
    if (!member) throw new NotFoundError("Personal", id);
    return member;
  }

  list(filter?: StaffFilter): Promise<Staff[]> {
    return this.staff.findMany(filter);
  }
}
