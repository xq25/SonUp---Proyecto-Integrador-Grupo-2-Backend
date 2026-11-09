import type { Child, ChildFilter } from "../../domain/child.entity.js";
import type { ChildReader } from "../../domain/child.reader.js";
import type { SagaHttpClient } from "./saga-http.client.js";
import { asRecord, compareText, matchesSearch, sagaCatalogName, sagaDate, sagaId, sagaText } from "./saga-values.js";

// Jóvenes desde la API de Saga (`/children`), en solo lectura (ADR-007).

export const toChild = (raw: unknown): Child => {
  const row = asRecord(raw, "joven");
  return {
    id: sagaId(row["child_id"], "child_id"),
    firstName: sagaText(row["first_name"]),
    lastName: sagaText(row["last_name"]),
    birthDate: sagaDate(row["birth_date"]),
    sexId: sagaText(row["sex_id"]),
    sexName: sagaCatalogName(row["sexes"]),
    documentTypeId: sagaText(row["document_type_id"]),
    documentTypeName: sagaCatalogName(row["document_types"]),
    documentNumber: sagaText(row["document_number"]),
    admissionDate: sagaDate(row["admission_date"]),
    exitDate: sagaDate(row["exit_date"]),
    statusId: sagaText(row["child_status_id"]),
    statusName: sagaCatalogName(row["child_statuses"]),
    notes: sagaText(row["notes"]),
    securityUserId: sagaText(row["security_user_id"]),
  };
};

export class SagaChildReader implements ChildReader {
  constructor(private readonly saga: SagaHttpClient) {}

  async findById(id: bigint): Promise<Child | null> {
    const row = await this.saga.find(`/children/${id}`);
    return row === null ? null : toChild(row);
  }

  async findByDocumentNumber(documentNumber: string): Promise<Child | null> {
    return (await this.all()).find((child) => child.documentNumber === documentNumber) ?? null;
  }

  async findMany(filter: ChildFilter = {}): Promise<Child[]> {
    return (await this.all())
      .filter((child) => filter.statusId === undefined || child.statusId === filter.statusId)
      .filter((child) => matchesSearch(filter.search, child.firstName, child.lastName, child.documentNumber))
      .sort((a, b) => compareText(a.lastName, b.lastName) || compareText(a.firstName, b.firstName));
  }

  async findBySecurityUserId(securityUserId: string): Promise<Child | null> {
    // Saga no filtra por `security_user_id`: se busca en el listado.
    return (await this.all()).find((child) => child.securityUserId === securityUserId) ?? null;
  }

  async all(): Promise<Child[]> {
    return (await this.saga.list("/children")).map(toChild);
  }
}
