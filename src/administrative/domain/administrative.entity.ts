import { isoDate, todayIsoDate } from "../../shared/domain/dates.js";

// Datos del módulo administrativo. Este módulo los consume en solo lectura:
// no extienden AuditableEntity porque la auditoría de esas tablas es de ellos.
// `sex`, `documentType` y `statusId` del joven son códigos de catálogos del
// módulo administrativo (aún no compartidos con nosotros).

/** Joven (`children`). */
export interface Child {
  id: bigint;
  firstName: string | null;
  lastName: string | null;
  birthDate: Date | null;
  sex: number | null;
  documentType: number | null;
  documentNumber: string | null;
  admissionDate: Date | null;
  exitDate: Date | null;
  statusId: number | null;
  notes: string | null;
}

/**
 * ¿El joven ya salió de la fundación? Es así si su `exitDate` es anterior a
 * hoy; el mismo día de salida todavía cuenta como activo. No se usa `statusId`
 * porque su catálogo aún no lo comparte el módulo administrativo.
 */
export function hasLeftFoundation(child: Pick<Child, "exitDate">, today: string = todayIsoDate()): boolean {
  return child.exitDate !== null && isoDate(child.exitDate) < today;
}

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

/** Vínculo joven–acudiente (`children_guardians`). `endDate = null` indica que sigue vigente. */
export interface ChildGuardian {
  id: bigint;
  childId: bigint;
  guardianId: bigint;
  guardianshipType: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

/** Vínculo con los datos del acudiente. */
export interface ChildGuardianWithGuardian extends ChildGuardian {
  guardian: Guardian;
}

/** Vínculo con los datos del joven. */
export interface ChildGuardianWithChild extends ChildGuardian {
  child: Child;
}

/** Tallerista (`professionals`). Sus datos personales están en `staff`, que no se integra. */
export interface Professional {
  id: bigint;
  staffId: bigint;
  titles: string | null;
  institutions: string | null;
  observations: string | null;
  timeDonor: boolean | null;
}

export interface ChildFilter {
  statusId?: number;
  /** Busca en nombres, apellidos o número de documento. */
  search?: string;
}

export interface GuardianFilter {
  /** Busca en nombre completo o número de documento. */
  search?: string;
}

export interface ProfessionalFilter {
  timeDonor?: boolean;
}
