import type { Prisma } from "./prisma.client.js";

/** Convierte un Decimal de Prisma (numeric) a number del dominio. */
export function decimalToNumber(value: Prisma.Decimal): number;
export function decimalToNumber(value: Prisma.Decimal | null): number | null;
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}
