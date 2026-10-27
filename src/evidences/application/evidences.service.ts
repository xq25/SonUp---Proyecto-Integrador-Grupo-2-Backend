import type { ActorId } from "../../shared/domain/auditable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import { parseInput } from "../../shared/application/validation.js";
import { hasLeftFoundation } from "../../administrative/domain/administrative.entity.js";
import type { ChildReader } from "../../administrative/domain/administrative.readers.js";
import {
  type Evidence,
  MAX_STUDENTS_PER_EVIDENCE,
  MIN_STUDENTS_PER_EVIDENCE,
  type StudentEvidence,
  type StudentEvidenceWithEvidence,
  type UpdateEvidenceInput,
  type UploadEvidenceInput,
} from "../domain/evidence.entity.js";
import type { EvidenceRepository, StudentEvidenceRepository } from "../domain/evidence.repository.js";
import { updateEvidenceSchema, uploadEvidenceSchema } from "./evidence.schemas.js";

/** Evidencias (§3.10): URL https, título obligatorio y de 1 a 50 estudiantes activos. */
export class EvidencesService {
  constructor(
    private readonly evidences: EvidenceRepository,
    private readonly studentEvidences: StudentEvidenceRepository,
    private readonly children: ChildReader,
  ) {}

  async get(id: bigint): Promise<Evidence> {
    const evidence = await this.evidences.findById(id);
    if (!evidence) throw new NotFoundError("Evidencia", id);
    return evidence;
  }

  /** Sube una evidencia relacionada con 1 a 50 estudiantes activos (de forma atómica). */
  async upload(data: UploadEvidenceInput, actor: ActorId): Promise<Evidence> {
    const input = parseInput(uploadEvidenceSchema, data, "Evidencia");
    for (const studentId of input.studentIds) await this.ensureActiveStudent(studentId);
    return this.evidences.create(input, actor);
  }

  async update(id: bigint, data: UpdateEvidenceInput, actor: ActorId): Promise<Evidence> {
    const input = parseInput(updateEvidenceSchema, data, "Evidencia");
    await this.get(id);
    return this.evidences.update(id, input, actor);
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    await this.evidences.delete(id, actor);
  }

  async listByStudent(studentId: bigint): Promise<StudentEvidenceWithEvidence[]> {
    await this.ensureStudentExists(studentId);
    return this.studentEvidences.findByStudent(studentId);
  }

  async listStudents(evidenceId: bigint): Promise<StudentEvidence[]> {
    await this.get(evidenceId);
    return this.studentEvidences.findByEvidence(evidenceId);
  }

  /** Relaciona un estudiante activo, sin superar el máximo de estudiantes por evidencia. */
  async linkStudent(evidenceId: bigint, studentId: bigint, actor: ActorId): Promise<StudentEvidence> {
    await this.get(evidenceId);
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
  async unlinkStudent(evidenceId: bigint, studentId: bigint, actor: ActorId): Promise<void> {
    const relation = await this.studentEvidences.find(studentId, evidenceId);
    if (!relation) throw new NotFoundError("Relación estudiante-evidencia");
    if ((await this.studentEvidences.findByEvidence(evidenceId)).length <= MIN_STUDENTS_PER_EVIDENCE) {
      throw new ConflictError("Es el único estudiante de la evidencia: elimine la evidencia en su lugar");
    }
    await this.studentEvidences.delete(relation.id, actor);
  }

  private async ensureStudentExists(studentId: bigint) {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
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
