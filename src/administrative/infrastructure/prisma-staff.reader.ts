import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Staff, StaffFilter } from "../domain/staff.entity.js";
import type { StaffReader } from "../domain/staff.reader.js";

// Solo consulta las tablas simuladas del módulo administrativo (desarrollo y pruebas sin Saga, ADR-007).

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

type StaffRow = Prisma.StaffGetPayload<{ select: typeof staffSelect }>;

// En el simulado, rol, estado y tipo de documento son textos; en Saga son ids de catálogo.
const toStaff = ({ documentType, role, status, ...row }: StaffRow): Staff => ({
  ...row,
  documentTypeId: documentType,
  roleId: role,
  statusId: status,
});

export class PrismaStaffReader implements StaffReader {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Staff | null> {
    const row = await this.prisma.staff.findUnique({ where: { id }, select: staffSelect });
    return row && toStaff(row);
  }

  async findMany(filter: StaffFilter = {}): Promise<Staff[]> {
    const where: Prisma.StaffWhereInput = {};
    if (filter.roleId !== undefined) where.role = filter.roleId;
    if (filter.statusId !== undefined) where.status = filter.statusId;
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ fullName: contains }, { documentNumber: contains }, { email: contains }];
    }
    const rows = await this.prisma.staff.findMany({ where, select: staffSelect, orderBy: { fullName: "asc" } });
    return rows.map(toStaff);
  }
}
