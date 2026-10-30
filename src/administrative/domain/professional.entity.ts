// Dato del módulo administrativo, en solo lectura (sin AuditableEntity).

/** Tallerista (`professionals`). Sus datos personales están en `staff`, que no se integra. */
export interface Professional {
  id: bigint;
  staffId: bigint;
  titles: string | null;
  institutions: string | null;
  observations: string | null;
  timeDonor: boolean | null;
}

export interface ProfessionalFilter {
  timeDonor?: boolean;
}
