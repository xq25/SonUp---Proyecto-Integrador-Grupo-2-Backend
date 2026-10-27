import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors.js";
import { Prisma } from "./prisma.client.js";

// Códigos de Postgres que llegan dentro del error del driver adapter.
const PG_CHECK_VIOLATION = "23514";
const PG_NOT_NULL_VIOLATION = "23502";
const PG_EXCLUSION_VIOLATION = "23P01";

/** Código original de Postgres, si el error viene del driver adapter. */
function postgresCode(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.originalCode;
}

/**
 * Ejecuta una operación de Prisma y traduce sus errores conocidos a errores
 * de dominio, para que la capa de aplicación no dependa del ORM.
 */
export async function withPrismaErrors<T>(
  entity: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (postgresCode(error)) {
        case PG_CHECK_VIOLATION:
        case PG_NOT_NULL_VIOLATION:
          throw new ValidationError(`${entity}: los datos no cumplen las reglas de la base de datos`);
        case PG_EXCLUSION_VIOLATION:
          throw new ConflictError(`${entity}: entra en conflicto con otro registro`);
      }
      switch (error.code) {
        case "P2002":
          throw new ConflictError(`${entity}: ya existe un registro con esos datos únicos`);
        case "P2003":
          throw new ValidationError(`${entity}: hace referencia a un registro que no existe`);
        case "P2025":
          throw new NotFoundError(entity);
      }
    }
    throw error;
  }
}
