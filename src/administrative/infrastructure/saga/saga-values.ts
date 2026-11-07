import { ExternalServiceError } from "../../../shared/domain/errors.js";

// Lectura tolerante de los valores que devuelve Saga (snake_case, ids como texto,
// fechas `YYYY-MM-DD`). Las comparten los lectores de las 5 entidades.

export type SagaRecord = Record<string, unknown>;

export const asRecord = (value: unknown, entity: string): SagaRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ExternalServiceError(`El módulo administrativo devolvió un ${entity} con formato inesperado`, "bad_response");
  }
  return value as SagaRecord;
};

/** Id obligatorio (`"12"` o `12`) → bigint. */
export const sagaId = (value: unknown, field: string): bigint => {
  const id = sagaOptionalId(value);
  if (id === null) throw new ExternalServiceError(`El módulo administrativo devolvió un registro sin ${field}`, "bad_response");
  return id;
};

/** Id opcional → bigint o `null`. */
export const sagaOptionalId = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if ((typeof value === "string" || typeof value === "number") && /^\d+$/.test(String(value))) return BigInt(value);
  return null;
};

export const sagaText = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
};

/** Fecha `YYYY-MM-DD` (o ISO completa) → Date, igual que una columna `date` leída con Prisma. */
export const sagaDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const sagaBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

/** Nombre de una entrada de catálogo anidada (`sexes: { code, name }`). */
export const sagaCatalogName = (value: unknown): string | null =>
  typeof value === "object" && value !== null ? sagaText((value as SagaRecord)["name"]) : null;

/** Búsqueda sin distinguir mayúsculas, como `mode: "insensitive"` en Prisma. */
export const matchesSearch = (search: string | undefined, ...values: (string | null)[]): boolean => {
  if (!search) return true;
  const needle = search.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(needle));
};

/** Orden ascendente con los `null` al final. */
export const compareText = (a: string | null, b: string | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b, "es");
