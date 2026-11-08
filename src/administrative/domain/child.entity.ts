import { isoDate, todayIsoDate } from "../../shared/domain/dates.js";

// Datos del módulo administrativo (Saga). Este módulo los consume en solo lectura:
// no extienden AuditableEntity porque la auditoría de esas tablas es de ellos.
// Los catálogos (sexo, tipo de documento, estado) llegan como id de Saga y, cuando
// Saga lo envía, con su nombre.

/** Joven (`children`). */
export interface Child {
  id: bigint;
  firstName: string | null;
  lastName: string | null;
  birthDate: Date | null;
  sexId: string | null;
  sexName: string | null;
  documentTypeId: string | null;
  documentTypeName: string | null;
  documentNumber: string | null;
  admissionDate: Date | null;
  exitDate: Date | null;
  statusId: string | null;
  statusName: string | null;
  /**
   * Anamnesis del joven (historia personal, familiar y de salud que registra el
   * módulo administrativo). Dato sensible: mostrarlo solo a quien corresponda.
   */
  notes: string | null;
  /** `sub` de la cuenta del servicio de seguridad enlazada (Saga `security_user_id`); null si no tiene cuenta. */
  securityUserId: string | null;
}

export interface ChildFilter {
  /** Id del estado en el catálogo de Saga (`child_status_id`). */
  statusId?: string;
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
