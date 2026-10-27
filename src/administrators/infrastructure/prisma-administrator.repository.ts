import type { ActorId, QueryOptions } from "../../shared/domain/auditable.js";
import type { DocumentType } from "../../shared/domain/document-types.js";
import { audit, auditSelect, deletedFilter } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  Administrator,
  AdministratorFilter,
  AdministratorStatus,
  CreateAdministratorInput,
  UpdateAdministratorInput,
} from "../domain/administrator.entity.js";
import type { AdministratorRepository } from "../domain/administrator.repository.js";

const administratorSelect = {
  id: true,
  fullName: true,
  documentType: true,
  documentNumber: true,
  email: true,
  phone: true,
  position: true,
  status: true,
  ...auditSelect,
} satisfies Prisma.AdministratorSelect;

type AdministratorRow = Prisma.AdministratorGetPayload<{ select: typeof administratorSelect }>;

// `status` y `documentType` están restringidos por checks en la BD.
const toAdministrator = (row: AdministratorRow): Administrator => ({
  ...row,
  documentType: row.documentType as DocumentType,
  status: row.status as AdministratorStatus,
});

const ENTITY = "Administrativo";

export class PrismaAdministratorRepository implements AdministratorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint, options?: QueryOptions): Promise<Administrator | null> {
    const row = await this.prisma.administrator.findFirst({
      where: { id, ...deletedFilter(options) },
      select: administratorSelect,
    });
    return row && toAdministrator(row);
  }

  async findByDocumentNumber(documentNumber: string): Promise<Administrator | null> {
    const row = await this.prisma.administrator.findUnique({ where: { documentNumber }, select: administratorSelect });
    return row && toAdministrator(row);
  }

  async findByEmail(email: string): Promise<Administrator | null> {
    const row = await this.prisma.administrator.findUnique({ where: { email }, select: administratorSelect });
    return row && toAdministrator(row);
  }

  async findMany(filter: AdministratorFilter = {}): Promise<Administrator[]> {
    const where: Prisma.AdministratorWhereInput = { ...deletedFilter(filter) };
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ fullName: contains }, { documentNumber: contains }, { email: contains }];
    }
    const rows = await this.prisma.administrator.findMany({
      where,
      select: administratorSelect,
      orderBy: { fullName: "asc" },
    });
    return rows.map(toAdministrator);
  }

  create(data: CreateAdministratorInput, actor: ActorId): Promise<Administrator> {
    return withPrismaErrors(ENTITY, async () =>
      toAdministrator(
        await this.prisma.administrator.create({
          data: { ...data, ...audit.create(actor) },
          select: administratorSelect,
        }),
      ),
    );
  }

  update(id: bigint, data: UpdateAdministratorInput, actor: ActorId): Promise<Administrator> {
    return withPrismaErrors(ENTITY, async () =>
      toAdministrator(
        await this.prisma.administrator.update({
          where: { id },
          data: { ...data, ...audit.update(actor) },
          select: administratorSelect,
        }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors(ENTITY, () =>
      this.prisma.administrator.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }

  restore(id: bigint, actor: ActorId): Promise<Administrator> {
    return withPrismaErrors(ENTITY, async () =>
      toAdministrator(
        await this.prisma.administrator.update({
          where: { id },
          data: audit.restore(actor),
          select: administratorSelect,
        }),
      ),
    );
  }
}
