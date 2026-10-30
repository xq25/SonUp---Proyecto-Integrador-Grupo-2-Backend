import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { StudentEvidence, StudentEvidenceWithEvidence } from "../domain/student-evidence.entity.js";
import type { StudentEvidenceRepository } from "../domain/student-evidence.repository.js";
import { evidenceSelect } from "./prisma-evidence.repository.js";

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
