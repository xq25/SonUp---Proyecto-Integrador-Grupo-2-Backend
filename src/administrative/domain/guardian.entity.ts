// Dato del módulo administrativo, en solo lectura (sin AuditableEntity).

/** Acudiente (`guardians`). */
export interface Guardian {
  id: bigint;
  fullName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  phone: string | null;
  address: string | null;
  legalStatusId: string | null;
}

export interface GuardianFilter {
  /** Busca en nombre completo o número de documento. */
  search?: string;
}
