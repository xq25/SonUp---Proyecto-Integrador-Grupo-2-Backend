import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  Credential,
  CredentialStatus,
  Evidence,
  RegisterCredentialInput,
  StudentEvidence,
  StudentEvidenceWithEvidence,
  UpdateCredentialInput,
  UpdateEvidenceInput,
  UploadEvidenceInput,
} from "../domain/evidence.entity.js";
import type {
  CredentialRepository,
  EvidenceRepository,
  StudentEvidenceRepository,
} from "../domain/evidence.repository.js";

const evidenceSelect = { id: true, url: true, title: true, ...auditSelect } satisfies Prisma.EvidenceSelect;

export class PrismaEvidenceRepository implements EvidenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<Evidence | null> {
    return this.prisma.evidence.findFirst({ where: { id, ...notDeleted }, select: evidenceSelect });
  }

  create(data: UploadEvidenceInput, actor: ActorId): Promise<Evidence> {
    const students = data.studentIds.map((studentId) => ({ studentId, ...audit.create(actor) }));
    return withPrismaErrors("Evidencia", () =>
      // create anidado: la evidencia y sus relaciones se insertan en una sola transacción.
      this.prisma.evidence.create({
        data: {
          url: data.url,
          title: data.title,
          ...audit.create(actor),
          students: { create: students },
        },
        select: evidenceSelect,
      }),
    );
  }

  update(id: bigint, data: UpdateEvidenceInput, actor: ActorId): Promise<Evidence> {
    return withPrismaErrors("Evidencia", () =>
      this.prisma.evidence.update({ where: { id }, data: { ...data, ...audit.update(actor) }, select: evidenceSelect }),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Evidencia", () =>
      this.prisma.$transaction([
        this.prisma.studentEvidence.updateMany({ where: { evidenceId: id, ...notDeleted }, data: audit.delete(actor) }),
        this.prisma.evidence.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
      ]),
    );
  }
}

const studentEvidenceSelect = {
  id: true,
  studentId: true,
  evidenceId: true,
  ...auditSelect,
} satisfies Prisma.StudentEvidenceSelect;

export class PrismaStudentEvidenceRepository implements StudentEvidenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  find(studentId: bigint, evidenceId: bigint): Promise<StudentEvidence | null> {
    return this.prisma.studentEvidence.findFirst({
      where: { studentId, evidenceId, ...notDeleted },
      select: studentEvidenceSelect,
    });
  }

  findByStudent(studentId: bigint): Promise<StudentEvidenceWithEvidence[]> {
    return this.prisma.studentEvidence.findMany({
      where: { studentId, ...notDeleted, evidence: notDeleted },
      select: { ...studentEvidenceSelect, evidence: { select: evidenceSelect } },
      orderBy: { createdAt: "desc" },
    });
  }

  findByEvidence(evidenceId: bigint): Promise<StudentEvidence[]> {
    return this.prisma.studentEvidence.findMany({
      where: { evidenceId, ...notDeleted },
      select: studentEvidenceSelect,
      orderBy: { studentId: "asc" },
    });
  }

  create(studentId: bigint, evidenceId: bigint, actor: ActorId): Promise<StudentEvidence> {
    return withPrismaErrors("Relación estudiante-evidencia", () =>
      this.prisma.studentEvidence.upsert({
        where: { studentId_evidenceId: { studentId, evidenceId } },
        create: { studentId, evidenceId, ...audit.create(actor) },
        update: audit.restore(actor),
        select: studentEvidenceSelect,
      }),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Relación estudiante-evidencia", () =>
      this.prisma.studentEvidence.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}

const credentialSelect = {
  id: true,
  studentId: true,
  organizationName: true,
  workshopId: true,
  url: true,
  status: true,
  ...auditSelect,
} satisfies Prisma.CredentialSelect;

type CredentialRow = Prisma.CredentialGetPayload<{ select: typeof credentialSelect }>;

// `status` está restringido por un check en la BD.
const toCredential = (row: CredentialRow): Credential => ({ ...row, status: row.status as CredentialStatus });

export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Credential | null> {
    const row = await this.prisma.credential.findFirst({ where: { id, ...notDeleted }, select: credentialSelect });
    return row && toCredential(row);
  }

  async findByStudent(studentId: bigint): Promise<Credential[]> {
    const rows = await this.prisma.credential.findMany({
      where: { studentId, ...notDeleted },
      select: credentialSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toCredential);
  }

  create(data: RegisterCredentialInput, actor: ActorId): Promise<Credential> {
    return withPrismaErrors("Credencial", async () =>
      toCredential(await this.prisma.credential.create({ data: { ...data, ...audit.create(actor) }, select: credentialSelect })),
    );
  }

  update(id: bigint, data: UpdateCredentialInput, actor: ActorId): Promise<Credential> {
    return withPrismaErrors("Credencial", async () =>
      toCredential(
        await this.prisma.credential.update({ where: { id }, data: { ...data, ...audit.update(actor) }, select: credentialSelect }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Credencial", () =>
      this.prisma.credential.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
