import { NotFoundError } from "../../shared/domain/errors.js";
import type {
  Child,
  ChildFilter,
  ChildGuardianWithChild,
  ChildGuardianWithGuardian,
  Guardian,
  GuardianFilter,
  Professional,
  ProfessionalFilter,
} from "../domain/administrative.entity.js";
import type { ChildReader, GuardianReader, ProfessionalReader } from "../domain/administrative.readers.js";

/** Consulta de la información del módulo administrativo (solo lectura). */
export class AdministrativeService {
  constructor(
    private readonly children: ChildReader,
    private readonly guardians: GuardianReader,
    private readonly professionals: ProfessionalReader,
  ) {}

  async getChild(id: bigint): Promise<Child> {
    const child = await this.children.findById(id);
    if (!child) throw new NotFoundError("Joven", id);
    return child;
  }

  findChildByDocument(documentNumber: string): Promise<Child | null> {
    return this.children.findByDocumentNumber(documentNumber);
  }

  listChildren(filter?: ChildFilter): Promise<Child[]> {
    return this.children.findMany(filter);
  }

  async getChildGuardians(childId: bigint, activeOnly = true): Promise<ChildGuardianWithGuardian[]> {
    await this.getChild(childId);
    return this.guardians.findByChild(childId, activeOnly);
  }

  async getGuardian(id: bigint): Promise<Guardian> {
    const guardian = await this.guardians.findById(id);
    if (!guardian) throw new NotFoundError("Acudiente", id);
    return guardian;
  }

  listGuardians(filter?: GuardianFilter): Promise<Guardian[]> {
    return this.guardians.findMany(filter);
  }

  async getGuardianChildren(guardianId: bigint, activeOnly = true): Promise<ChildGuardianWithChild[]> {
    await this.getGuardian(guardianId);
    return this.guardians.findChildrenOf(guardianId, activeOnly);
  }

  async getProfessional(id: bigint): Promise<Professional> {
    const professional = await this.professionals.findById(id);
    if (!professional) throw new NotFoundError("Tallerista", id);
    return professional;
  }

  findProfessionalByStaffId(staffId: bigint): Promise<Professional | null> {
    return this.professionals.findByStaffId(staffId);
  }

  listProfessionals(filter?: ProfessionalFilter): Promise<Professional[]> {
    return this.professionals.findMany(filter);
  }
}
