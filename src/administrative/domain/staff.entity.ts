// Dato del módulo administrativo (Saga), en solo lectura (sin AuditableEntity).

/**
 * Personal de la fundación (`staff`): administrativos y talleristas (estos se
 * enlazan desde `professionals.staff_id`). `role` y `status` son valores de Saga.
 * No se exponen `contract_type`, `hours_worked` ni `hours_payed`: son datos
 * laborales que este módulo no usa.
 */
export interface Staff {
  id: bigint;
  fullName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  role: string | null;
  hireDate: Date | null;
  exitDate: Date | null;
  status: string | null;
  phone: string | null;
  email: string | null;
}

export interface StaffFilter {
  role?: string;
  status?: string;
  /** Busca en el nombre completo, el número de documento o el email. */
  search?: string;
}
