import type { Child } from "./child.entity.js";
import type { Guardian } from "./guardian.entity.js";

// Dato del módulo administrativo, en solo lectura (sin AuditableEntity).

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
