import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { ChildGuardianWithChild, ChildGuardianWithGuardian } from "../domain/child-guardian.entity.js";
import type { ChildGuardianReader } from "../domain/child-guardian.reader.js";
import { childSelect } from "./prisma-child.reader.js";
import { guardianSelect } from "./prisma-guardian.reader.js";

// Solo consulta: la tabla es del módulo administrativo (sin escritura ni auditoría).

const childGuardianSelect = {
  id: true,
  childId: true,
  guardianId: true,
  guardianshipType: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.ChildGuardianSelect;

export class PrismaChildGuardianReader implements ChildGuardianReader {
  constructor(private readonly prisma: PrismaClient) {}

  findByChild(childId: bigint, activeOnly = false): Promise<ChildGuardianWithGuardian[]> {
    const where: Prisma.ChildGuardianWhereInput = { childId };
    if (activeOnly) where.endDate = null;
    return this.prisma.childGuardian.findMany({
      where,
      select: { ...childGuardianSelect, guardian: { select: guardianSelect } },
      orderBy: { startDate: "desc" },
    });
  }

  findByGuardian(guardianId: bigint, activeOnly = false): Promise<ChildGuardianWithChild[]> {
    const where: Prisma.ChildGuardianWhereInput = { guardianId };
    if (activeOnly) where.endDate = null;
    return this.prisma.childGuardian.findMany({
      where,
      select: { ...childGuardianSelect, child: { select: childSelect } },
      orderBy: { startDate: "desc" },
    });
  }
}
