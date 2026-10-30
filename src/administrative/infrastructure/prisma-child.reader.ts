import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Child, ChildFilter } from "../domain/child.entity.js";
import type { ChildReader } from "../domain/child.reader.js";

// Lectores Prisma de las tablas del módulo administrativo. Solo consultan:
// no hay create/update/delete ni auditoría (las tablas no son nuestras).

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
} satisfies Prisma.ChildSelect;

export class PrismaChildReader implements ChildReader {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<Child | null> {
    return this.prisma.child.findUnique({ where: { id }, select: childSelect });
  }

  findByDocumentNumber(documentNumber: string): Promise<Child | null> {
    // findFirst: el diagrama no marca el documento como único.
    return this.prisma.child.findFirst({ where: { documentNumber }, select: childSelect });
  }

  findMany(filter: ChildFilter = {}): Promise<Child[]> {
    const where: Prisma.ChildWhereInput = {};
    if (filter.statusId !== undefined) where.statusId = filter.statusId;
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ firstName: contains }, { lastName: contains }, { documentNumber: contains }];
    }
    return this.prisma.child.findMany({
      where,
      select: childSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }
}
