// Dato del módulo administrativo (Saga), en solo lectura (sin AuditableEntity).

/** Acudiente (`guardians`). Los catálogos llegan como id de Saga y, si lo envía, con su nombre. */
export interface Guardian {
  id: bigint;
  fullName: string | null;
  documentTypeId: string | null;
  documentTypeName: string | null;
  documentNumber: string | null;
  phone: string | null;
  address: string | null;
  legalStatusId: string | null;
  legalStatusName: string | null;
}

export interface GuardianFilter {
  /** Busca en nombre completo o número de documento. */
  search?: string;
}
