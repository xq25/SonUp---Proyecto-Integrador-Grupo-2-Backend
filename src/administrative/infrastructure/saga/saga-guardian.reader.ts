import type { Guardian, GuardianFilter } from "../../domain/guardian.entity.js";
import type { GuardianReader } from "../../domain/guardian.reader.js";
import type { SagaHttpClient } from "./saga-http.client.js";
import { asRecord, compareText, matchesSearch, sagaCatalogName, sagaId, sagaText } from "./saga-values.js";

// Acudientes desde la API de Saga (`/guardians`), en solo lectura (ADR-007).

export const toGuardian = (raw: unknown): Guardian => {
  const row = asRecord(raw, "acudiente");
  return {
    id: sagaId(row["guardian_id"], "guardian_id"),
    fullName: sagaText(row["full_name"]),
    documentTypeId: sagaText(row["document_type_id"]),
    documentTypeName: sagaCatalogName(row["document_types"]),
    documentNumber: sagaText(row["document_number"]),
    phone: sagaText(row["phone"]),
    address: sagaText(row["address"]),
    legalStatusId: sagaText(row["legal_status_id"]),
    legalStatusName: sagaCatalogName(row["legal_statuses"]),
  };
};

export class SagaGuardianReader implements GuardianReader {
  constructor(private readonly saga: SagaHttpClient) {}

  async findById(id: bigint): Promise<Guardian | null> {
    const row = await this.saga.find(`/guardians/${id}`);
    return row === null ? null : toGuardian(row);
  }

  async findMany(filter: GuardianFilter = {}): Promise<Guardian[]> {
    return (await this.all())
      .filter((guardian) => matchesSearch(filter.search, guardian.fullName, guardian.documentNumber))
      .sort((a, b) => compareText(a.fullName, b.fullName));
  }

  async all(): Promise<Guardian[]> {
    return (await this.saga.list("/guardians")).map(toGuardian);
  }
}
