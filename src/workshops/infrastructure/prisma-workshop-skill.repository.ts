import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { WorkshopSkill } from "../domain/workshop-skill.entity.js";
import type { WorkshopSkillRepository } from "../domain/workshop-skill.repository.js";

const workshopSkillSelect = { id: true, workshopId: true, skillId: true, ...auditSelect } satisfies Prisma.WorkshopSkillSelect;

export class PrismaWorkshopSkillRepository implements WorkshopSkillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<WorkshopSkill | null> {
    return this.prisma.workshopSkill.findFirst({ where: { id, ...notDeleted }, select: workshopSkillSelect });
  }

  find(workshopId: bigint, skillId: bigint): Promise<WorkshopSkill | null> {
    return this.prisma.workshopSkill.findFirst({ where: { workshopId, skillId, ...notDeleted }, select: workshopSkillSelect });
  }

  findByWorkshop(workshopId: bigint): Promise<WorkshopSkill[]> {
    return this.prisma.workshopSkill.findMany({
      where: { workshopId, ...notDeleted },
      select: workshopSkillSelect,
      orderBy: { id: "asc" },
    });
  }

  async hasEvaluations(id: bigint): Promise<boolean> {
    // Mismo criterio que el historial de calificaciones: evaluación y asistencia vigentes.
    const row = await this.prisma.evaluationSkill.findFirst({
      where: { workshopSkillId: id, ...notDeleted, attendance: notDeleted },
      select: { id: true },
    });
    return row !== null;
  }

  create(workshopId: bigint, skillId: bigint, actor: ActorId): Promise<WorkshopSkill> {
    return withPrismaErrors("Habilidad del taller", () =>
      this.prisma.workshopSkill.upsert({
        where: { workshopId_skillId: { workshopId, skillId } },
        create: { workshopId, skillId, ...audit.create(actor) },
        update: audit.restore(actor),
        select: workshopSkillSelect,
      }),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Habilidad del taller", () =>
      this.prisma.workshopSkill.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
