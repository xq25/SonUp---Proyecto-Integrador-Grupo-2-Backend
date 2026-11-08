import type { ChildGuardianReader } from "../../administrative/domain/child-guardian.reader.js";
import type { CredentialRepository } from "../../evidences/domain/credential.repository.js";
import type { StudentEvidenceRepository } from "../../evidences/domain/student-evidence.repository.js";
import { ForbiddenError } from "../../shared/domain/errors.js";
import type { WorkshopAttendanceRepository } from "../../workshops/domain/workshop-attendance.repository.js";
import type { WorkshopFilter, WorkshopStatus } from "../../workshops/domain/workshop.entity.js";
import type { WorkshopRepository } from "../../workshops/domain/workshop.repository.js";
import type { ActorLinksResolver } from "../domain/actor-links.resolver.js";
import type { Principal } from "../domain/principal.entity.js";
import { ROLES } from "../domain/roles.js";

// Acceso a "lo suyo" (ADR-008 §2.6). La matriz de rutas decide QUÉ ROL entra a
// cada ruta; esta política decide, dentro de la ruta, A QUÉ REGISTROS:
// - ADMIN: a todo.
// - TALLERISTA: a todos los jóvenes (con su anamnesis), pero solo a SUS talleres
//   (los de su `professionalId`) y a sus asistencias y evaluaciones.
// - ESTUDIANTE: a los talleres disponibles y a lo suyo (su `childId`).
// - ACUDIENTE: a los talleres disponibles y a lo de sus jóvenes (vínculos vigentes de su `guardianId`).
// A quién de Saga corresponde el usuario lo dice `ActorLinksResolver` (Saga
// `security_user_id` = `sub`). Si el registro no existe, no se bloquea: el
// servicio responde 404 como siempre.

/** Talleres "publicados" que jóvenes y acudientes ven: por hacerse o en curso. */
export const AVAILABLE_WORKSHOP_STATUSES: readonly WorkshopStatus[] = ["planned", "active"];

/** Id del cuerpo de la petición, si tiene forma válida (si no, el esquema del servicio lo rechaza). */
export function bodyId(body: unknown, key: string): bigint | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return BigInt(value);
  if (typeof value === "string" && /^[1-9]\d{0,18}$/.test(value.trim())) return BigInt(value.trim());
  return undefined;
}

export class AccessPolicy {
  constructor(
    private readonly workshops: WorkshopRepository,
    private readonly attendances: WorkshopAttendanceRepository,
    private readonly childGuardians: ChildGuardianReader,
    private readonly credentials: CredentialRepository,
    private readonly studentEvidences: StudentEvidenceRepository,
    private readonly links: ActorLinksResolver,
  ) {}

  // ── Talleres ──

  /** Filtro del listado de talleres según quién consulta. */
  async workshopFilter(principal: Principal, filter: WorkshopFilter): Promise<WorkshopFilter> {
    if (this.isAdmin(principal)) return filter;
    const { includeDeleted: _ignored, ...visible } = filter;
    if (this.isLeader(principal)) {
      const own = await this.professionalIdOf(principal);
      if (visible.evaluatorId !== undefined && visible.evaluatorId !== own) {
        throw new ForbiddenError("Solo puedes consultar tus propios talleres");
      }
      return { ...visible, evaluatorId: own };
    }
    if (visible.status !== undefined && !AVAILABLE_WORKSHOP_STATUSES.includes(visible.status as WorkshopStatus)) {
      throw new ForbiddenError(`Solo puedes consultar talleres disponibles (${AVAILABLE_WORKSHOP_STATUSES.join(", ")}); tu historial está en tus asistencias`);
    }
    return { ...visible, status: visible.status ?? [...AVAILABLE_WORKSHOP_STATUSES] };
  }

  /** Ver un taller (y sus habilidades): el tallerista los suyos; jóvenes y acudientes, los disponibles o a los que asistieron. */
  async assertCanReadWorkshop(principal: Principal, workshopId: bigint): Promise<void> {
    if (this.isAdmin(principal)) return;
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) return;
    if (this.isLeader(principal)) return await this.assertOwnWorkshop(principal, workshop.evaluatorId);
    if (AVAILABLE_WORKSHOP_STATUSES.includes(workshop.status)) return;
    for (const studentId of await this.ownStudentIds(principal)) {
      if (await this.attendances.hasAttended(workshopId, studentId)) return;
    }
    throw new ForbiddenError("Solo puedes ver talleres disponibles o en los que has participado");
  }

  /** Modificar un taller, sus habilidades o sus asistencias: solo su tallerista (o ADMIN). */
  async assertCanManageWorkshop(principal: Principal, workshopId: bigint): Promise<void> {
    if (this.isAdmin(principal)) return;
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) return;
    await this.assertOwnWorkshop(principal, workshop.evaluatorId);
  }

  /** Crear un taller: el tallerista solo a su nombre (`evaluatorId` = su `professionalId`). */
  async assertCanCreateWorkshop(principal: Principal, body: unknown): Promise<void> {
    if (this.isAdmin(principal)) return;
    const evaluatorId = bodyId(body, "evaluatorId");
    if (evaluatorId !== undefined) await this.assertOwnWorkshop(principal, evaluatorId);
  }

  /** Editar un taller: suyo, y sin pasárselo a otro tallerista. */
  async assertCanUpdateWorkshop(principal: Principal, workshopId: bigint, body: unknown): Promise<void> {
    await this.assertCanManageWorkshop(principal, workshopId);
    if (this.isAdmin(principal)) return;
    const evaluatorId = bodyId(body, "evaluatorId");
    if (evaluatorId !== undefined) await this.assertOwnWorkshop(principal, evaluatorId);
  }

  // ── Asistencias y evaluaciones ──

  /** Modificar una asistencia o sus evaluaciones: solo en los talleres del tallerista. */
  async assertCanManageAttendance(principal: Principal, attendanceId: bigint): Promise<void> {
    if (this.isAdmin(principal)) return;
    const attendance = await this.attendances.findById(attendanceId);
    if (!attendance) return;
    await this.assertCanManageWorkshop(principal, attendance.workshopId);
  }

  /** Ver una asistencia o sus evaluaciones: el tallerista en sus talleres; el joven o acudiente, las suyas. */
  async assertCanReadAttendance(principal: Principal, attendanceId: bigint): Promise<void> {
    if (this.isAdmin(principal)) return;
    const attendance = await this.attendances.findById(attendanceId);
    if (!attendance) return;
    if (this.isLeader(principal)) return this.assertCanManageWorkshop(principal, attendance.workshopId);
    await this.assertCanReadStudent(principal, attendance.studentId);
  }

  // ── Jóvenes y acudientes ──

  /** Datos y avance de un joven: ADMIN y talleristas, todos; el joven, él mismo; el acudiente, sus jóvenes. */
  async assertCanReadStudent(principal: Principal, studentId: bigint): Promise<void> {
    if (this.isAdmin(principal) || this.isLeader(principal)) return;
    if ((await this.ownStudentIds(principal)).includes(studentId)) return;
    throw new ForbiddenError("Solo puedes consultar tu propia información (o la de tus jóvenes)");
  }

  /** Datos de un acudiente: ADMIN, o el mismo acudiente. */
  async assertCanReadGuardian(principal: Principal, guardianId: bigint): Promise<void> {
    if (this.isAdmin(principal)) return;
    if (this.has(principal, ROLES.guardian) && (await this.links.resolve(principal)).guardianId === guardianId) return;
    throw new ForbiddenError("Solo puedes consultar tu propia información de acudiente");
  }

  // ── Evidencias y certificados ──

  async assertCanReadCredential(principal: Principal, credentialId: bigint): Promise<void> {
    if (this.isAdmin(principal) || this.isLeader(principal)) return;
    const credential = await this.credentials.findById(credentialId);
    if (!credential) return;
    await this.assertCanReadStudent(principal, credential.studentId);
  }

  async assertCanReadEvidence(principal: Principal, evidenceId: bigint): Promise<void> {
    if (this.isAdmin(principal) || this.isLeader(principal)) return;
    const own = await this.ownStudentIds(principal);
    const links = await this.studentEvidences.findByEvidence(evidenceId);
    if (links.length === 0 || links.some((link) => own.includes(link.studentId))) return;
    throw new ForbiddenError("Solo puedes ver evidencias en las que apareces (o aparecen tus jóvenes)");
  }

  // ── Apoyo ──

  private has(principal: Principal, role: string): boolean {
    return principal.roles.includes(role);
  }

  private isAdmin(principal: Principal): boolean {
    return this.has(principal, ROLES.admin);
  }

  private isLeader(principal: Principal): boolean {
    return this.has(principal, ROLES.workshopLeader);
  }

  private async professionalIdOf(principal: Principal): Promise<bigint> {
    const id = (await this.links.resolve(principal)).professionalId;
    if (id === undefined) {
      throw new ForbiddenError(
        "Tu cuenta no está enlazada con un tallerista en el módulo administrativo: regístrate o enlázate primero (POST /staff/register de Saga)",
      );
    }
    return id;
  }

  private async assertOwnWorkshop(principal: Principal, evaluatorId: bigint): Promise<void> {
    if ((await this.professionalIdOf(principal)) !== evaluatorId) {
      throw new ForbiddenError("Solo puedes gestionar tus propios talleres");
    }
  }

  /** Jóvenes del usuario: él mismo (ESTUDIANTE) y/o sus jóvenes con vínculo vigente (ACUDIENTE). */
  private async ownStudentIds(principal: Principal): Promise<bigint[]> {
    const ids: bigint[] = [];
    let linked = false;
    const { childId, guardianId } = await this.links.resolve(principal);
    if (this.has(principal, ROLES.student) && childId !== undefined) {
      linked = true;
      ids.push(childId);
    }
    if (this.has(principal, ROLES.guardian) && guardianId !== undefined) {
      linked = true;
      for (const link of await this.childGuardians.findByGuardian(guardianId, true)) ids.push(link.childId);
    }
    if (!linked) {
      throw new ForbiddenError(
        "Tu cuenta no está enlazada con un joven o acudiente en el módulo administrativo: regístrate o enlázate primero (POST /children/register o /guardians/register de Saga)",
      );
    }
    return ids;
  }
}
