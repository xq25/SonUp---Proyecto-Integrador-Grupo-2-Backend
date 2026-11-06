import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Staff, StaffFilter } from "../domain/staff.entity.js";
import type { StaffReader } from "../domain/staff.reader.js";

// Solo consulta: la tabla es del módulo administrativo (sin escritura ni auditoría).

const staffSelect = {
  id: true,
  fullName: true,
  documentType: true,
  documentNumber: true,
  role: true,
  hireDate: true,
  exitDate: true,
  status: true,
  phone: true,
  email: true,
} satisfies Prisma.StaffSelect;

export class PrismaStaffReader implements StaffReader {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { id }, select: staffSelect });
  }

  findMany(filter: StaffFilter = {}): Promise<Staff[]> {
    const where: Prisma.StaffWhereInput = {};
    if (filter.role !== undefined) where.role = filter.role;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ fullName: contains }, { documentNumber: contains }, { email: contains }];
    }
    return this.prisma.staff.findMany({ where, select: staffSelect, orderBy: { fullName: "asc" } });
  }
}
