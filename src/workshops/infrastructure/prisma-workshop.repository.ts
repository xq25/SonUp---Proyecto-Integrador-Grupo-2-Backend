import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, deletedFilter, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  CreateWorkshopInput,
  UpdateWorkshopInput,
  Workshop,
  WorkshopFilter,
  WorkshopStatus,
} from "../domain/workshop.entity.js";
import type { WorkshopRepository } from "../domain/workshop.repository.js";

const workshopSelect = {
  id: true,
  evaluatorId: true,
  name: true,
  startsAt: true,
  endsAt: true,
  status: true,
  ...auditSelect,
} satisfies Prisma.WorkshopSelect;

type WorkshopRow = Prisma.WorkshopGetPayload<{ select: typeof workshopSelect }>;

// `status` está restringido por un check en la BD.
const toWorkshop = (row: WorkshopRow): Workshop => ({ ...row, status: row.status as WorkshopStatus });

export class PrismaWorkshopRepository implements WorkshopRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Workshop | null> {
    const row = await this.prisma.workshop.findFirst({ where: { id, ...notDeleted }, select: workshopSelect });
    return row && toWorkshop(row);
  }

  async findMany(filter: WorkshopFilter = {}): Promise<Workshop[]> {
    const where: Prisma.WorkshopWhereInput = { ...deletedFilter(filter) };
    if (filter.evaluatorId !== undefined) where.evaluatorId = filter.evaluatorId;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.search) where.name = { contains: filter.search, mode: "insensitive" };
    const rows = await this.prisma.workshop.findMany({
      where,
      select: workshopSelect,
      orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    });
    return rows.map(toWorkshop);
  }

  async findLastAttendedAt(id: bigint): Promise<Date | null> {
    const row = await this.prisma.workshopAttendance.findFirst({
      where: { workshopId: id, ...notDeleted },
      select: { attendedAt: true },
      orderBy: { attendedAt: "desc" },
    });
    return row?.attendedAt ?? null;
  }

  async hasAttendances(id: bigint): Promise<boolean> {
    const row = await this.prisma.workshopAttendance.findFirst({
      where: { workshopId: id, ...notDeleted },
      select: { id: true },
    });
    return row !== null;
  }

  create(data: CreateWorkshopInput, actor: ActorId): Promise<Workshop> {
    return withPrismaErrors("Taller", async () =>
      toWorkshop(await this.prisma.workshop.create({ data: { ...data, ...audit.create(actor) }, select: workshopSelect })),
    );
  }

  update(id: bigint, data: UpdateWorkshopInput, actor: ActorId): Promise<Workshop> {
    return withPrismaErrors("Taller", async () =>
      toWorkshop(
        await this.prisma.workshop.update({ where: { id }, data: { ...data, ...audit.update(actor) }, select: workshopSelect }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Taller", () =>
      this.prisma.workshop.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
