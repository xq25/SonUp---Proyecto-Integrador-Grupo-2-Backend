import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  ChildGuardian,
  ChildGuardianWithChild,
  ChildGuardianWithGuardian,
} from "../domain/child-guardian.entity.js";
import type { ChildGuardianReader } from "../domain/child-guardian.reader.js";
import { childSelect, toChild } from "./prisma-child.reader.js";
import { guardianSelect, toGuardian } from "./prisma-guardian.reader.js";

// Solo consulta las tablas simuladas del módulo administrativo (desarrollo y pruebas sin Saga, ADR-007).

const childGuardianSelect = {
  id: true,
  childId: true,
  guardianId: true,
  guardianshipType: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.ChildGuardianSelect;

type ChildGuardianRow = Prisma.ChildGuardianGetPayload<{ select: typeof childGuardianSelect }>;

const toChildGuardian = ({ guardianshipType, ...row }: ChildGuardianRow): ChildGuardian => ({
  ...row,
  guardianshipTypeId: guardianshipType,
});

export class PrismaChildGuardianReader implements ChildGuardianReader {
  constructor(private readonly prisma: PrismaClient) {}

  async findByChild(childId: bigint, activeOnly = false): Promise<ChildGuardianWithGuardian[]> {
    const where: Prisma.ChildGuardianWhereInput = { childId };
    if (activeOnly) where.endDate = null;
    const rows = await this.prisma.childGuardian.findMany({
      where,
      select: { ...childGuardianSelect, guardian: { select: guardianSelect } },
      orderBy: { startDate: "desc" },
    });
    return rows.map(({ guardian, ...link }) => ({ ...toChildGuardian(link), guardian: toGuardian(guardian) }));
  }

  async findByGuardian(guardianId: bigint, activeOnly = false): Promise<ChildGuardianWithChild[]> {
    const where: Prisma.ChildGuardianWhereInput = { guardianId };
    if (activeOnly) where.endDate = null;
    const rows = await this.prisma.childGuardian.findMany({
      where,
      select: { ...childGuardianSelect, child: { select: childSelect } },
      orderBy: { startDate: "desc" },
    });
    return rows.map(({ child, ...link }) => ({ ...toChildGuardian(link), child: toChild(child) }));
  }
}
