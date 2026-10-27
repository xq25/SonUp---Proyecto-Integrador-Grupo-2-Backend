import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../../generated/prisma/client.js";

// Único punto del proyecto que importa el cliente generado:
// las features consumen estos re-exports, nunca la ruta de `generated/`.
export { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

/**
 * Crea un PrismaClient conectado a la base de datos general (Supabase).
 * En runtime se usa DATABASE_URL (pooler de Supabase); las migraciones y
 * la CLI usan la URL configurada en prisma7.config.ts.
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env["DATABASE_URL"],
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
