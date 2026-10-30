import { ConflictError } from "../../shared/domain/errors.js";
import type { Credential, CredentialStatus, UpdateCredentialInput } from "./credential.entity.js";

// Ciclo de vida de una credencial (docs/VALIDACIONES.md §3.12). Funciones puras.

/**
 * Transiciones permitidas:
 *   pending ──▶ valid ──▶ revoked
 *      └──────────────────▲          (revoked es final)
 */
export const CREDENTIAL_TRANSITIONS: Readonly<Record<CredentialStatus, readonly CredentialStatus[]>> = {
  pending: ["valid", "revoked"],
  valid: ["revoked"],
  revoked: [],
};

/** Estado con el que nace toda credencial. */
export const INITIAL_CREDENTIAL_STATUS = "pending" satisfies CredentialStatus;

export function ensureCanTransitionCredential(from: CredentialStatus, to: CredentialStatus): void {
  if (from === to) return;
  if (!CREDENTIAL_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Una credencial no puede pasar de "${from}" a "${to}"`);
  }
}

/** Solo una credencial `pending` cambia sus datos; `valid` y `revoked` solo cambian de estado. */
export function ensureCredentialEditable(current: Credential, data: UpdateCredentialInput): void {
  if (current.status === "pending") return;
  const changed = (["organizationName", "workshopId", "url"] as const).filter(
    (field) => data[field] !== undefined && data[field] !== current[field],
  );
  if (changed.length > 0) {
    throw new ConflictError(
      `Solo una credencial "pending" se edita; esta está "${current.status}" (campos: ${changed.join(", ")})`,
    );
  }
}

/** Solo se elimina una credencial `pending`; las demás se revocan. */
export function ensureCredentialDeletable(current: Credential): void {
  if (current.status !== "pending") {
    throw new ConflictError(`Una credencial "${current.status}" no se elimina; se revoca`);
  }
}
