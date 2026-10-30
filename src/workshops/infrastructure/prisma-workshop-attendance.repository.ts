import type { ActorId } from "../../shared/domain/auditable.js";
import { appDayRange } from "../../shared/domain/dates.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  RegisterAttendanceInput,
  UpdateAttendanceInput,
  WorkshopAttendance,
} from "../domain/workshop-attendance.entity.js";
import type { WorkshopAttendanceRepository } from "../domain/workshop-attendance.repository.js";

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
