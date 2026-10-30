import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Professional, ProfessionalFilter } from "../domain/professional.entity.js";
import type { ProfessionalReader } from "../domain/professional.reader.js";

// Solo consulta: la tabla es del módulo administrativo (sin escritura ni auditoría).

const professionalSelect = {
  id: true,
  staffId: true,
  titles: true,
  institutions: true,
  observations: true,
  timeDonor: true,
} satisfies Prisma.ProfessionalSelect;

export class PrismaProfessionalReader implements ProfessionalReader {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<Professional | null> {
    return this.prisma.professional.findUnique({ where: { id }, select: professionalSelect });
  }

  findByStaffId(staffId: bigint): Promise<Professional | null> {
    return this.prisma.professional.findFirst({ where: { staffId }, select: professionalSelect });
  }

  findMany(filter: ProfessionalFilter = {}): Promise<Professional[]> {
    const where: Prisma.ProfessionalWhereInput = {};
    if (filter.timeDonor !== undefined) where.timeDonor = filter.timeDonor;
    return this.prisma.professional.findMany({ where, select: professionalSelect, orderBy: { id: "asc" } });
  }
}
