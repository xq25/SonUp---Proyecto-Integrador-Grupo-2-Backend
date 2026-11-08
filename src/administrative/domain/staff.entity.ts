// Dato del módulo administrativo (Saga), en solo lectura (sin AuditableEntity).

/**
 * Personal de la fundación (`staff`): administrativos y talleristas (estos se
 * enlazan desde `professionals.staff_id`). Rol, estado y tipo de documento son
 * ids de los catálogos de Saga. No se exponen el tipo de contrato ni las horas:
 * son datos laborales que este módulo no usa.
 */
export interface Staff {
  id: bigint;
  fullName: string | null;
  documentTypeId: string | null;
  documentNumber: string | null;
  roleId: string | null;
  hireDate: Date | null;
  exitDate: Date | null;
  statusId: string | null;
  phone: string | null;
  email: string | null;
  /** `sub` de la cuenta del servicio de seguridad enlazada (Saga `security_user_id`); null si no tiene cuenta. */
  securityUserId: string | null;
}

export interface StaffFilter {
  /** Id del rol en el catálogo de Saga (`staff_role_id`). */
  roleId?: string;
  /** Id del estado en el catálogo de Saga (`staff_status_id`). */
  statusId?: string;
  /** Busca en el nombre completo, el número de documento o el email. */
  search?: string;
}
