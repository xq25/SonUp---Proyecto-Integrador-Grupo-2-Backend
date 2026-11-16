import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { NewAttendance, UpdateAttendanceInput, WorkshopAttendance } from "../domain/workshop-attendance.entity.js";
import type { WorkshopAttendanceRepository } from "../domain/workshop-attendance.repository.js";

const attendanceSelect = {
  id: true,
  studentId: true,
  workshopId: true,
  sessionId: true,
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

  findBySession(sessionId: bigint): Promise<WorkshopAttendance[]> {
    return this.prisma.workshopAttendance.findMany({
      where: { sessionId, ...notDeleted },
      select: attendanceSelect,
      orderBy: { id: "asc" },
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

  findInSession(sessionId: bigint, studentId: bigint): Promise<WorkshopAttendance | null> {
    return this.prisma.workshopAttendance.findFirst({
      where: { sessionId, studentId, ...notDeleted },
      select: attendanceSelect,
    });
  }

  create(data: NewAttendance, actor: ActorId): Promise<WorkshopAttendance> {
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
