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

export interface ChildFilter {
  statusId?: number;
  /** Busca en nombres, apellidos o número de documento. */
  search?: string;
}

/**
 * ¿El joven ya salió de la fundación? Es así si su `exitDate` es anterior a
 * hoy; el mismo día de salida todavía cuenta como activo. No se usa `statusId`
 * porque su catálogo aún no lo comparte el módulo administrativo.
 */
export function hasLeftFoundation(child: Pick<Child, "exitDate">, today: string = todayIsoDate()): boolean {
  return child.exitDate !== null && isoDate(child.exitDate) < today;
}
