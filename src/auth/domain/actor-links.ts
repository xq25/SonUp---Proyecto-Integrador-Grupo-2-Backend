import type { ActorLinks } from "./principal.entity.js";

// Ids de Saga que llegan en las cabeceras de desarrollo (X-Actor-Professional-Id,
// X-Actor-Child-Id, X-Actor-Guardian-Id). En producción el enlace no viene en el
// token: lo resuelve ActorLinksService con `security_user_id` de Saga (ADR-008).

const CLAIMS: Record<keyof ActorLinks, readonly string[]> = {
  professionalId: ["professionalId", "professional_id", "talleristaId", "tallerista_id"],
  staffId: ["staffId", "staff_id"],
  childId: ["childId", "child_id", "estudianteId", "estudiante_id"],
  guardianId: ["guardianId", "guardian_id", "acudienteId", "acudiente_id"],
};

/** Id positivo (número o texto de dígitos) → bigint; cualquier otra cosa se ignora. */
const toId = (value: unknown): bigint | undefined => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return BigInt(value);
  if (typeof value === "string" && /^[1-9]\d{0,18}$/.test(value.trim())) return BigInt(value.trim());
  return undefined;
};

export function linksFromClaims(claims: Record<string, unknown>): ActorLinks {
  const links: ActorLinks = {};
  for (const key of Object.keys(CLAIMS) as (keyof ActorLinks)[]) {
    for (const name of CLAIMS[key]) {
      const id = toId(claims[name]);
      if (id !== undefined) {
        links[key] = id;
        break;
      }
    }
  }
  return links;
}
