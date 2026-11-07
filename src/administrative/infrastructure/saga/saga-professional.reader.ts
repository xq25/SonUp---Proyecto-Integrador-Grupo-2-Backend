import type { Professional, ProfessionalFilter } from "../../domain/professional.entity.js";
import type { ProfessionalReader } from "../../domain/professional.reader.js";
import type { SagaHttpClient } from "./saga-http.client.js";
import { asRecord, sagaBoolean, sagaId, sagaOptionalId, sagaText } from "./saga-values.js";

// Talleristas desde la API de Saga (`/professionals`), en solo lectura (ADR-007).

const toProfessional = (raw: unknown): Professional => {
  const row = asRecord(raw, "tallerista");
  return {
    id: sagaId(row["professional_id"], "professional_id"),
    staffId: sagaOptionalId(row["staff_id"]),
    titles: sagaText(row["titles"]),
    institutions: sagaText(row["institutions"]),
    observations: sagaText(row["observations"]),
    timeDonor: sagaBoolean(row["time_donor"]),
  };
};

export class SagaProfessionalReader implements ProfessionalReader {
  constructor(private readonly saga: SagaHttpClient) {}

  async findById(id: bigint): Promise<Professional | null> {
    const row = await this.saga.find(`/professionals/${id}`);
    return row === null ? null : toProfessional(row);
  }

  async findByStaffId(staffId: bigint): Promise<Professional | null> {
    return (await this.all()).find((professional) => professional.staffId === staffId) ?? null;
  }

  async findMany(filter: ProfessionalFilter = {}): Promise<Professional[]> {
    return (await this.all())
      .filter((professional) => filter.timeDonor === undefined || professional.timeDonor === filter.timeDonor)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  private async all(): Promise<Professional[]> {
    return (await this.saga.list("/professionals")).map(toProfessional);
  }
}
