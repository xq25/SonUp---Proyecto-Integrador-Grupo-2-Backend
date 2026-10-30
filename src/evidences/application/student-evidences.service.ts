import { hasLeftFoundation } from "../../administrative/domain/child.entity.js";
import type { ChildReader } from "../../administrative/domain/child.reader.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import { MAX_STUDENTS_PER_EVIDENCE, MIN_STUDENTS_PER_EVIDENCE } from "../domain/evidence.entity.js";
import type { EvidenceRepository } from "../domain/evidence.repository.js";
import type { StudentEvidence, StudentEvidenceWithEvidence } from "../domain/student-evidence.entity.js";
import type { StudentEvidenceRepository } from "../domain/student-evidence.repository.js";

/** Estudiantes relacionados con cada evidencia (§3.10): de 1 a 50, activos al relacionarlos. */
export class StudentEvidencesService {
  constructor(
    private readonly studentEvidences: StudentEvidenceRepository,
    private readonly evidences: EvidenceRepository,
    private readonly children: ChildReader,
  ) {}

  async listByStudent(studentId: bigint): Promise<StudentEvidenceWithEvidence[]> {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
    return this.studentEvidences.findByStudent(studentId);
  }

  async listByEvidence(evidenceId: bigint): Promise<StudentEvidence[]> {
    await this.ensureEvidenceExists(evidenceId);
    return this.studentEvidences.findByEvidence(evidenceId);
  }

  /** Relaciona un estudiante activo, sin superar el máximo de estudiantes por evidencia. */
  async link(evidenceId: bigint, studentId: bigint, actor: ActorId): Promise<StudentEvidence> {
    await this.ensureEvidenceExists(evidenceId);
    await this.ensureActiveStudent(studentId);
    if (await this.studentEvidences.find(studentId, evidenceId)) {
      throw new ConflictError("El estudiante ya está relacionado con la evidencia");
    }
    if ((await this.studentEvidences.findByEvidence(evidenceId)).length >= MAX_STUDENTS_PER_EVIDENCE) {
      throw new ConflictError(`La evidencia ya tiene el máximo de ${MAX_STUDENTS_PER_EVIDENCE} estudiantes`);
    }
    return this.studentEvidences.create(studentId, evidenceId, actor);
  }

  /** No se quita el último estudiante: una evidencia sin estudiantes se elimina. */
  async unlink(evidenceId: bigint, studentId: bigint, actor: ActorId): Promise<void> {
    const relation = await this.studentEvidences.find(studentId, evidenceId);
    if (!relation) throw new NotFoundError("Relación estudiante-evidencia");
    if ((await this.studentEvidences.findByEvidence(evidenceId)).length <= MIN_STUDENTS_PER_EVIDENCE) {
      throw new ConflictError("Es el único estudiante de la evidencia: elimine la evidencia en su lugar");
    }
    await this.studentEvidences.delete(relation.id, actor);
  }

  private async ensureEvidenceExists(evidenceId: bigint) {
    if (!(await this.evidences.findById(evidenceId))) throw new NotFoundError("Evidencia", evidenceId);
  }

  /** Para relacionar evidencias nuevas, el estudiante no debe haber salido de la fundación. */
  private async ensureActiveStudent(studentId: bigint) {
    const child = await this.children.findById(studentId);
    if (!child) throw new NotFoundError("Estudiante", studentId);
    if (hasLeftFoundation(child)) {
      throw new ValidationError(`El estudiante ${studentId} ya salió de la fundación: no se le relacionan evidencias nuevas`);
    }
  }
}
