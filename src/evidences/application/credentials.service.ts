import type { ActorId } from "../../shared/domain/auditable.js";
import { NotFoundError, ValidationError } from "../../shared/domain/errors.js";
import { parseInput } from "../../shared/application/validation.js";
import type { ChildReader } from "../../administrative/domain/administrative.readers.js";
import type { WorkshopAttendanceRepository, WorkshopRepository } from "../../workshops/domain/workshop.repository.js";
import {
  INITIAL_CREDENTIAL_STATUS,
  ensureCanTransitionCredential,
  ensureCredentialDeletable,
  ensureCredentialEditable,
} from "../domain/credential.rules.js";
import type { Credential, RegisterCredentialInput, UpdateCredentialInput } from "../domain/evidence.entity.js";
import type { CredentialRepository } from "../domain/evidence.repository.js";
import { registerCredentialSchema, updateCredentialSchema } from "./evidence.schemas.js";

/**
 * Credenciales o certificados que obtienen los estudiantes (§3.12).
 * No se exige que el estudiante siga activo: puede registrarse después de su salida.
 */
export class CredentialsService {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly workshops: WorkshopRepository,
    private readonly attendances: WorkshopAttendanceRepository,
    private readonly children: ChildReader,
  ) {}

  async get(id: bigint): Promise<Credential> {
    const credential = await this.credentials.findById(id);
    if (!credential) throw new NotFoundError("Credencial", id);
    return credential;
  }

  async listByStudent(studentId: bigint): Promise<Credential[]> {
    if (!(await this.children.findById(studentId))) throw new NotFoundError("Estudiante", studentId);
    return this.credentials.findByStudent(studentId);
  }

  /** Toda credencial nace `pending`, con organización y URL (https) obligatorias. */
  async register(data: RegisterCredentialInput, actor: ActorId): Promise<Credential> {
    const input: RegisterCredentialInput = {
      ...parseInput(registerCredentialSchema, data, "Credencial"),
      status: INITIAL_CREDENTIAL_STATUS,
    };
    if (!(await this.children.findById(input.studentId))) throw new NotFoundError("Estudiante", input.studentId);
    if (input.workshopId) await this.ensureWorkshopCompletedBy(input.workshopId, input.studentId);
    return this.credentials.create(input, actor);
  }

  /** Solo `pending` cambia sus datos; `valid` y `revoked` solo cambian de estado (§3.12). */
  async update(id: bigint, data: UpdateCredentialInput, actor: ActorId): Promise<Credential> {
    const input = parseInput(updateCredentialSchema, data, "Credencial");
    const current = await this.get(id);

    ensureCredentialEditable(current, input);
    ensureCanTransitionCredential(current.status, input.status ?? current.status);
    if (input.workshopId && input.workshopId !== current.workshopId) {
      await this.ensureWorkshopCompletedBy(input.workshopId, current.studentId);
    }
    return this.credentials.update(id, input, actor);
  }

  /** Solo se elimina si está `pending`; las demás se revocan. */
  async delete(id: bigint, actor: ActorId): Promise<void> {
    ensureCredentialDeletable(await this.get(id));
    await this.credentials.delete(id, actor);
  }

  /** El taller debe estar `finished` y el estudiante debe haber asistido al menos una vez. */
  private async ensureWorkshopCompletedBy(workshopId: bigint, studentId: bigint) {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) throw new NotFoundError("Taller", workshopId);
    if (workshop.status !== "finished") {
      throw new ValidationError(`La credencial solo se asocia a talleres "finished"; este está "${workshop.status}"`);
    }
    if (!(await this.attendances.hasAttended(workshopId, studentId))) {
      throw new ValidationError("El estudiante no tiene asistencias en ese taller");
    }
  }
}
