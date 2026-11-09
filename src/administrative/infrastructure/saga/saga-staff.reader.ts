import type { Staff, StaffFilter } from "../../domain/staff.entity.js";
import type { StaffReader } from "../../domain/staff.reader.js";
import type { SagaHttpClient } from "./saga-http.client.js";
import { asRecord, compareText, matchesSearch, sagaDate, sagaId, sagaText } from "./saga-values.js";

// Personal desde la API de Saga (`/staff`), en solo lectura (ADR-007).
// No se leen el tipo de contrato ni las horas (datos laborales).

const toStaff = (raw: unknown): Staff => {
  const row = asRecord(raw, "miembro del personal");
  return {
    id: sagaId(row["staff_id"], "staff_id"),
    fullName: sagaText(row["full_name"]),
    documentTypeId: sagaText(row["document_type_id"]),
    documentNumber: sagaText(row["document_number"]),
    roleId: sagaText(row["staff_role_id"]),
    hireDate: sagaDate(row["hire_date"]),
    exitDate: sagaDate(row["exit_date"]),
    statusId: sagaText(row["staff_status_id"]),
    phone: sagaText(row["phone"]),
    email: sagaText(row["email"]),
    securityUserId: sagaText(row["security_user_id"]),
  };
};

export class SagaStaffReader implements StaffReader {
  constructor(private readonly saga: SagaHttpClient) {}

  async findById(id: bigint): Promise<Staff | null> {
    const row = await this.saga.find(`/staff/${id}`);
    return row === null ? null : toStaff(row);
  }

  async findMany(filter: StaffFilter = {}): Promise<Staff[]> {
    return (await this.saga.list("/staff"))
      .map(toStaff)
      .filter((member) => filter.roleId === undefined || member.roleId === filter.roleId)
      .filter((member) => filter.statusId === undefined || member.statusId === filter.statusId)
      .filter((member) => matchesSearch(filter.search, member.fullName, member.documentNumber, member.email))
      .sort((a, b) => compareText(a.fullName, b.fullName));
  }

  /** Saga no filtra por `security_user_id`: se busca en el listado. */
  async findBySecurityUserId(securityUserId: string): Promise<Staff | null> {
    return (await this.saga.list("/staff")).map(toStaff).find((item) => item.securityUserId === securityUserId) ?? null;
  }
}
