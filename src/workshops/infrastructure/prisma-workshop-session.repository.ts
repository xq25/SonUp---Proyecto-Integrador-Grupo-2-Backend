import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  CreateWorkshopSessionInput,
  WorkshopSession,
  WorkshopSessionChanges,
  WorkshopSessionStatus,
} from "../domain/workshop-session.entity.js";
import type { WorkshopSessionRepository } from "../domain/workshop-session.repository.js";

const sessionSelect = {
  id: true,
  workshopId: true,
  startsAt: true,
  endsAt: true,
  topic: true,
  objective: true,
  materials: true,
  steps: true,
  status: true,
  ...auditSelect,
} satisfies Prisma.WorkshopSessionSelect;

type SessionRow = Prisma.WorkshopSessionGetPayload<{ select: typeof sessionSelect }>;

// `status` está restringido por un check en la BD.
const toSession = (row: SessionRow): WorkshopSession => ({ ...row, status: row.status as WorkshopSessionStatus });

export class PrismaWorkshopSessionRepository implements WorkshopSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<WorkshopSession | null> {
    const row = await this.prisma.workshopSession.findFirst({ where: { id, ...notDeleted }, select: sessionSelect });
    return row && toSession(row);
  }

  async findByWorkshop(workshopId: bigint): Promise<WorkshopSession[]> {
    const rows = await this.prisma.workshopSession.findMany({
      where: { workshopId, ...notDeleted },
      select: sessionSelect,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toSession);
  }

  create(workshopId: bigint, data: CreateWorkshopSessionInput, actor: ActorId): Promise<WorkshopSession> {
    return withPrismaErrors("Sesión", async () =>
      toSession(
        await this.prisma.workshopSession.create({
          data: { ...data, workshopId, status: "planned", ...audit.create(actor) },
          select: sessionSelect,
        }),
      ),
    );
  }

  update(id: bigint, data: WorkshopSessionChanges, actor: ActorId): Promise<WorkshopSession> {
    return withPrismaErrors("Sesión", async () =>
      toSession(
        await this.prisma.workshopSession.update({
          where: { id },
          data: { ...data, ...audit.update(actor) },
          select: sessionSelect,
        }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Sesión", () =>
      this.prisma.workshopSession.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
