import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  Child,
  ChildFilter,
  ChildGuardianWithChild,
  ChildGuardianWithGuardian,
  Guardian,
  GuardianFilter,
  Professional,
  ProfessionalFilter,
} from "../domain/administrative.entity.js";
import type { ChildReader, GuardianReader, ProfessionalReader } from "../domain/administrative.readers.js";

// Lectores Prisma de las tablas del módulo administrativo. Solo consultan:
// no hay create/update/delete ni auditoría (las tablas no son nuestras).

const childSelect = {
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

const guardianSelect = {
  id: true,
  fullName: true,
  documentType: true,
  documentNumber: true,
  phone: true,
  address: true,
  legalStatusId: true,
} satisfies Prisma.GuardianSelect;

const childGuardianSelect = {
  id: true,
  childId: true,
  guardianId: true,
  guardianshipType: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.ChildGuardianSelect;

const professionalSelect = {
  id: true,
  staffId: true,
  titles: true,
  institutions: true,
  observations: true,
  timeDonor: true,
} satisfies Prisma.ProfessionalSelect;

const insensitive = (value: string) => ({ contains: value, mode: "insensitive" }) as const;

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
      const contains = insensitive(filter.search);
      where.OR = [{ firstName: contains }, { lastName: contains }, { documentNumber: contains }];
    }
    return this.prisma.child.findMany({
      where,
      select: childSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }
}

export class PrismaGuardianReader implements GuardianReader {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<Guardian | null> {
    return this.prisma.guardian.findUnique({ where: { id }, select: guardianSelect });
  }

  findMany(filter: GuardianFilter = {}): Promise<Guardian[]> {
    const where: Prisma.GuardianWhereInput = {};
    if (filter.search) {
      const contains = insensitive(filter.search);
      where.OR = [{ fullName: contains }, { documentNumber: contains }];
    }
    return this.prisma.guardian.findMany({ where, select: guardianSelect, orderBy: { fullName: "asc" } });
  }

  findByChild(childId: bigint, activeOnly = false): Promise<ChildGuardianWithGuardian[]> {
    const where: Prisma.ChildGuardianWhereInput = { childId };
    if (activeOnly) where.endDate = null;
    return this.prisma.childGuardian.findMany({
      where,
      select: { ...childGuardianSelect, guardian: { select: guardianSelect } },
      orderBy: { startDate: "desc" },
    });
  }

  findChildrenOf(guardianId: bigint, activeOnly = false): Promise<ChildGuardianWithChild[]> {
    const where: Prisma.ChildGuardianWhereInput = { guardianId };
    if (activeOnly) where.endDate = null;
    return this.prisma.childGuardian.findMany({
      where,
      select: { ...childGuardianSelect, child: { select: childSelect } },
      orderBy: { startDate: "desc" },
    });
  }
}

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
