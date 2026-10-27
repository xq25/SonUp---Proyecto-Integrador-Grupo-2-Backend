import { ConflictError, ValidationError } from "../../shared/domain/errors.js";
import type { UpdateWorkshopInput, Workshop, WorkshopStatus } from "./workshop.entity.js";

// Reglas del ciclo de vida de un taller (docs/VALIDACIONES.md §3.6). Funciones puras.

/**
 * Transiciones permitidas:
 *   planned ──▶ active ──▶ finished
 *      │           │
 *      └─────┬─────┘
 *            ▼
 *        cancelled        (finished y cancelled son finales)
 */
export const WORKSHOP_TRANSITIONS: Readonly<Record<WorkshopStatus, readonly WorkshopStatus[]>> = {
  planned: ["active", "cancelled"],
  active: ["finished", "cancelled"],
  finished: [],
  cancelled: [],
};

/** Estado con el que nace todo taller. */
export const INITIAL_WORKSHOP_STATUS = "planned" satisfies WorkshopStatus;

export function ensureCanTransition(from: WorkshopStatus, to: WorkshopStatus): void {
  if (from === to) return;
  if (!WORKSHOP_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Un taller no puede pasar de "${from}" a "${to}"`);
  }
}

/** Campos que exige cada estado y orden de las fechas. */
export function ensureStatusRequirements(
  status: WorkshopStatus,
  startsAt: Date | null,
  endsAt: Date | null,
): void {
  if ((status === "active" || status === "finished") && !startsAt) {
    throw new ValidationError(`Un taller "${status}" debe tener fecha de inicio`);
  }
  if (status === "finished" && !endsAt) {
    throw new ValidationError('Un taller "finished" debe tener fecha de fin');
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ValidationError("La fecha de fin no puede ser anterior a la de inicio");
  }
}

/**
 * Qué se puede cambiar según el estado actual:
 * - `planned`: todo.
 * - `active`: solo el estado; al pasar a `finished` se puede enviar `endsAt` en el mismo cambio.
 * - `finished` / `cancelled`: nada (son finales).
 */
export function ensureEditable(current: Workshop, data: UpdateWorkshopInput): void {
  if (current.status === "planned") return;

  const changed = (["evaluatorId", "name", "startsAt", "endsAt"] as const).filter((field) => {
    const value = data[field];
    if (value === undefined) return false;
    const before = current[field];
    return value instanceof Date && before instanceof Date ? value.getTime() !== before.getTime() : value !== before;
  });
  const closingWithEndDate = current.status === "active" && data.status === "finished";
  const blocked = closingWithEndDate ? changed.filter((field) => field !== "endsAt") : changed;

  if (blocked.length > 0) {
    throw new ConflictError(
      `Solo un taller "planned" se puede editar; este está "${current.status}" (campos: ${blocked.join(", ")})`,
    );
  }
}
