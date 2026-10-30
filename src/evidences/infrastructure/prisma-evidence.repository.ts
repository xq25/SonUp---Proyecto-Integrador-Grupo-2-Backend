import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Evidence, UpdateEvidenceInput, UploadEvidenceInput } from "../domain/evidence.entity.js";
import type { EvidenceRepository } from "../domain/evidence.repository.js";

export const evidenceSelect = { id: true, url: true, title: true, ...auditSelect } satisfies Prisma.EvidenceSelect;

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
