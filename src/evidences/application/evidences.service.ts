import { hasLeftFoundation } from "../../administrative/domain/child.entity.js";
import type { ChildReader } from "../../administrative/domain/child.reader.js";
import { parseInput } from "../../shared/application/validation.js";
import type { ActorId } from "../../shared/domain/auditable.js";
import { NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import type { Evidence, UpdateEvidenceInput, UploadEvidenceInput } from "../domain/evidence.entity.js";
import type { EvidenceRepository } from "../domain/evidence.repository.js";
import { updateEvidenceSchema, uploadEvidenceSchema } from "./evidence.schemas.js";

/** Evidencias (§3.10): URL https, título obligatorio y de 1 a 50 estudiantes activos. */
export class EvidencesService {
  constructor(
    private readonly evidences: EvidenceRepository,
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
    for (const studentId of input.studentIds) {
      const child = await this.children.findById(studentId);
      if (!child) throw new NotFoundError("Estudiante", studentId);
      if (hasLeftFoundation(child)) {
        throw new ValidationError(`El estudiante ${studentId} ya salió de la fundación: no se le relacionan evidencias nuevas`);
      }
    }
    return this.evidences.create(input, actor);
  }

  async update(id: bigint, data: UpdateEvidenceInput, actor: ActorId): Promise<Evidence> {
    const input = parseInput(updateEvidenceSchema, data, "Evidencia");
    await this.get(id);
    return this.evidences.update(id, input, actor);
  }

  /** Oculta también sus relaciones con estudiantes. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    await this.get(id);
    await this.evidences.delete(id, actor);
  }
}
