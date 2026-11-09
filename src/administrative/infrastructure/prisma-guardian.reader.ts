import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Guardian, GuardianFilter } from "../domain/guardian.entity.js";
import type { GuardianReader } from "../domain/guardian.reader.js";

// Solo consulta las tablas simuladas del módulo administrativo (desarrollo y pruebas sin Saga, ADR-007).

export const guardianSelect = {
  id: true,
  fullName: true,
  documentType: true,
  documentNumber: true,
  phone: true,
  address: true,
  legalStatusId: true,
  securityUserId: true,
} satisfies Prisma.GuardianSelect;

type GuardianRow = Prisma.GuardianGetPayload<{ select: typeof guardianSelect }>;

export const toGuardian = (row: GuardianRow): Guardian => ({
  id: row.id,
  fullName: row.fullName,
  documentTypeId: row.documentType,
  documentTypeName: null,
  documentNumber: row.documentNumber,
  phone: row.phone,
  address: row.address,
  legalStatusId: row.legalStatusId,
  legalStatusName: null,
  securityUserId: row.securityUserId,
});

export class PrismaGuardianReader implements GuardianReader {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Guardian | null> {
    const row = await this.prisma.guardian.findUnique({ where: { id }, select: guardianSelect });
    return row && toGuardian(row);
  }

  async findBySecurityUserId(securityUserId: string): Promise<Guardian | null> {
    const row = await this.prisma.guardian.findFirst({ where: { securityUserId }, select: guardianSelect });
    return row && toGuardian(row);
  }

  async findMany(filter: GuardianFilter = {}): Promise<Guardian[]> {
    const where: Prisma.GuardianWhereInput = {};
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ fullName: contains }, { documentNumber: contains }];
    }
    const rows = await this.prisma.guardian.findMany({ where, select: guardianSelect, orderBy: { fullName: "asc" } });
    return rows.map(toGuardian);
  }
}
