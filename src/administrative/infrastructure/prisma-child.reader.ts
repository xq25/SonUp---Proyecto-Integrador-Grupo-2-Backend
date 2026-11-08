import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Child, ChildFilter } from "../domain/child.entity.js";
import type { ChildReader } from "../domain/child.reader.js";

// Lectores Prisma de las tablas simuladas del módulo administrativo (esquema
// `administrativo`): solo para desarrollo y pruebas sin Saga (ADR-007). Solo
// consultan: no hay create/update/delete ni auditoría.

export const childSelect = {
  id: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  sex: true,
  documentType: true,
  documentNumber: true,
  admissionDate: true,
  exitDate: true,
  statusId: true,
  notes: true,
  securityUserId: true,
} satisfies Prisma.ChildSelect;

type ChildRow = Prisma.ChildGetPayload<{ select: typeof childSelect }>;

// El simulado guarda los catálogos como códigos numéricos y no tiene sus nombres.
const code = (value: number | null) => (value === null ? null : String(value));

export const toChild = (row: ChildRow): Child => ({
  id: row.id,
  firstName: row.firstName,
  lastName: row.lastName,
  birthDate: row.birthDate,
  sexId: code(row.sex),
  sexName: null,
  documentTypeId: code(row.documentType),
  documentTypeName: null,
  documentNumber: row.documentNumber,
  admissionDate: row.admissionDate,
  exitDate: row.exitDate,
  statusId: code(row.statusId),
  statusName: null,
  notes: row.notes,
  securityUserId: row.securityUserId,
});

export class PrismaChildReader implements ChildReader {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Child | null> {
    const row = await this.prisma.child.findUnique({ where: { id }, select: childSelect });
    return row && toChild(row);
  }

  async findByDocumentNumber(documentNumber: string): Promise<Child | null> {
    // findFirst: el diagrama no marca el documento como único.
    const row = await this.prisma.child.findFirst({ where: { documentNumber }, select: childSelect });
    return row && toChild(row);
  }

  async findBySecurityUserId(securityUserId: string): Promise<Child | null> {
    const row = await this.prisma.child.findFirst({ where: { securityUserId }, select: childSelect });
    return row && toChild(row);
  }

  async findMany(filter: ChildFilter = {}): Promise<Child[]> {
    const where: Prisma.ChildWhereInput = {};
    if (filter.statusId !== undefined) {
      // En el simulado el estado es numérico: un id no numérico no coincide con ninguno.
      if (!/^\d+$/.test(filter.statusId)) return [];
      where.statusId = Number(filter.statusId);
    }
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ firstName: contains }, { lastName: contains }, { documentNumber: contains }];
    }
    const rows = await this.prisma.child.findMany({
      where,
      select: childSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map(toChild);
  }
}
