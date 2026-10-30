import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  Credential,
  CredentialStatus,
  RegisterCredentialInput,
  UpdateCredentialInput,
} from "../domain/credential.entity.js";
import type { CredentialRepository } from "../domain/credential.repository.js";

const credentialSelect = {
  id: true,
  studentId: true,
  organizationName: true,
  workshopId: true,
  url: true,
  status: true,
  ...auditSelect,
} satisfies Prisma.CredentialSelect;

type CredentialRow = Prisma.CredentialGetPayload<{ select: typeof credentialSelect }>;

// `status` está restringido por un check en la BD.
const toCredential = (row: CredentialRow): Credential => ({ ...row, status: row.status as CredentialStatus });

export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<Credential | null> {
    const row = await this.prisma.credential.findFirst({ where: { id, ...notDeleted }, select: credentialSelect });
    return row && toCredential(row);
  }

  async findByStudent(studentId: bigint): Promise<Credential[]> {
    const rows = await this.prisma.credential.findMany({
      where: { studentId, ...notDeleted },
      select: credentialSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toCredential);
  }

  create(data: RegisterCredentialInput, actor: ActorId): Promise<Credential> {
    return withPrismaErrors("Credencial", async () =>
      toCredential(await this.prisma.credential.create({ data: { ...data, ...audit.create(actor) }, select: credentialSelect })),
    );
  }

  update(id: bigint, data: UpdateCredentialInput, actor: ActorId): Promise<Credential> {
    return withPrismaErrors("Credencial", async () =>
      toCredential(
        await this.prisma.credential.update({ where: { id }, data: { ...data, ...audit.update(actor) }, select: credentialSelect }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Credencial", () =>
      this.prisma.credential.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
