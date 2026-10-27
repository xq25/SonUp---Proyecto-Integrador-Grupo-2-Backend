import type { ActorId } from "../../shared/domain/auditable.js";
import { appDayRange } from "../../shared/domain/dates.js";
import { audit, auditSelect, deletedFilter, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  CreateWorkshopInput,
  RegisterAttendanceInput,
  UpdateAttendanceInput,
  UpdateWorkshopInput,
  Workshop,
  WorkshopAttendance,
  WorkshopFilter,
  WorkshopSkill,
  WorkshopStatus,
} from "../domain/workshop.entity.js";
import type {
  WorkshopAttendanceRepository,
  WorkshopRepository,
  WorkshopSkillRepository,
} from "../domain/workshop.repository.js";

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

const attendanceSelect = {
  id: true,
  studentId: true,
  workshopId: true,
  attendedAt: true,
  observation: true,
  ...auditSelect,
} satisfies Prisma.WorkshopAttendanceSelect;

export class PrismaWorkshopAttendanceRepository implements WorkshopAttendanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: bigint): Promise<WorkshopAttendance | null> {
    return this.prisma.workshopAttendance.findFirst({ where: { id, ...notDeleted }, select: attendanceSelect });
  }

  findByWorkshop(workshopId: bigint): Promise<WorkshopAttendance[]> {
    return this.prisma.workshopAttendance.findMany({
      where: { workshopId, ...notDeleted },
      select: attendanceSelect,
      orderBy: { attendedAt: "desc" },
    });
  }

  findByStudent(studentId: bigint): Promise<WorkshopAttendance[]> {
    return this.prisma.workshopAttendance.findMany({
      where: { studentId, ...notDeleted },
      select: attendanceSelect,
      orderBy: { attendedAt: "desc" },
    });
  }

  async hasAttended(workshopId: bigint, studentId: bigint): Promise<boolean> {
    const row = await this.prisma.workshopAttendance.findFirst({
      where: { workshopId, studentId, ...notDeleted },
      select: { id: true },
    });
    return row !== null;
  }

  findOnDay(workshopId: bigint, studentId: bigint, day: string): Promise<WorkshopAttendance | null> {
    // Mismo criterio que el índice único de la BD: el día en hora de Bogotá.
    const { start, end } = appDayRange(day);
    return this.prisma.workshopAttendance.findFirst({
      where: { workshopId, studentId, attendedAt: { gte: start, lt: end }, ...notDeleted },
      select: attendanceSelect,
    });
  }

  create(data: RegisterAttendanceInput, actor: ActorId): Promise<WorkshopAttendance> {
    return withPrismaErrors("Asistencia", () =>
      this.prisma.workshopAttendance.create({ data: { ...data, ...audit.create(actor) }, select: attendanceSelect }),
    );
  }

  update(id: bigint, data: UpdateAttendanceInput, actor: ActorId): Promise<WorkshopAttendance> {
    return withPrismaErrors("Asistencia", () =>
      this.prisma.workshopAttendance.update({
        where: { id },
        data: { ...data, ...audit.update(actor) },
        select: attendanceSelect,
      }),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Asistencia", () =>
      this.prisma.workshopAttendance.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
