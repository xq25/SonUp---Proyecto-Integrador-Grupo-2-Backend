// Dato del módulo administrativo (Saga), en solo lectura (sin AuditableEntity).

/** Tallerista (`professionals`). Sus datos personales están en `staff` (`staffId`, que Saga puede dejar vacío). */
export interface Professional {
  id: bigint;
  staffId: bigint | null;
  titles: string | null;
  institutions: string | null;
  observations: string | null;
  timeDonor: boolean | null;
}

export interface ProfessionalFilter {
  timeDonor?: boolean;
}
