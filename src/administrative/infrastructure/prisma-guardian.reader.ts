import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Guardian, GuardianFilter } from "../domain/guardian.entity.js";
import type { GuardianReader } from "../domain/guardian.reader.js";

// Solo consulta: la tabla es del módulo administrativo (sin escritura ni auditoría).

export const guardianSelect = {
  id: true,
  fullName: true,
  documentType: true,
  documentNumber: true,
  phone: true,
  address: true,
  legalStatusId: true,
} satisfies Prisma.GuardianSelect;

export class PrismaGuardianReader implements GuardianReader {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<Guardian | null> {
    return this.prisma.guardian.findUnique({ where: { id }, select: guardianSelect });
  }

  findMany(filter: GuardianFilter = {}): Promise<Guardian[]> {
    const where: Prisma.GuardianWhereInput = {};
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ fullName: contains }, { documentNumber: contains }];
    }
    return this.prisma.guardian.findMany({ where, select: guardianSelect, orderBy: { fullName: "asc" } });
  }
}
