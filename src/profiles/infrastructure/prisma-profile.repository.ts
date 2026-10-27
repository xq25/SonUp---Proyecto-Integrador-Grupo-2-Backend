import type { ActorId, QueryOptions } from "../../shared/domain/auditable.js";
import { audit, auditSelect, deletedFilter } from "../../shared/infrastructure/prisma/audit.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type { Profile, ProfileFilter, ProfileStatus, UpdateProfileInput } from "../domain/profile.entity.js";
import type { ProfileRepository } from "../domain/profile.repository.js";

const profileSelect = {
  id: true,
  firstNames: true,
  lastNames: true,
  phone: true,
  documentType: true,
  documentNumber: true,
  status: true,
  dataProcessingAcceptedAt: true,
  ...auditSelect,
} satisfies Prisma.ProfileSelect;

type ProfileRow = Prisma.ProfileGetPayload<{ select: typeof profileSelect }>;

// `status` está restringido por un check en la BD.
const toProfile = (row: ProfileRow): Profile => ({ ...row, status: row.status as ProfileStatus });

const ENTITY = "Perfil";

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, options?: QueryOptions): Promise<Profile | null> {
    const row = await this.prisma.profile.findFirst({
      where: { id, ...deletedFilter(options) },
      select: profileSelect,
    });
    return row && toProfile(row);
  }

  async findByDocumentNumber(documentNumber: string): Promise<Profile | null> {
    const row = await this.prisma.profile.findUnique({ where: { documentNumber }, select: profileSelect });
    return row && toProfile(row);
  }

  async findMany(filter: ProfileFilter = {}): Promise<Profile[]> {
    const where: Prisma.ProfileWhereInput = { ...deletedFilter(filter) };
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.search) {
      const contains = { contains: filter.search, mode: "insensitive" } as const;
      where.OR = [{ firstNames: contains }, { lastNames: contains }, { documentNumber: contains }];
    }
    const rows = await this.prisma.profile.findMany({
      where,
      select: profileSelect,
      orderBy: [{ lastNames: "asc" }, { firstNames: "asc" }],
    });
    return rows.map(toProfile);
  }

  update(id: string, data: UpdateProfileInput, actor: ActorId): Promise<Profile> {
    return withPrismaErrors(ENTITY, async () =>
      toProfile(
        await this.prisma.profile.update({
          where: { id },
          data: { ...data, ...audit.update(actor) },
          select: profileSelect,
        }),
      ),
    );
  }

  async delete(id: string, actor: ActorId): Promise<void> {
    await withPrismaErrors(ENTITY, () =>
      this.prisma.profile.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }

  restore(id: string, actor: ActorId): Promise<Profile> {
    return withPrismaErrors(ENTITY, async () =>
      toProfile(await this.prisma.profile.update({ where: { id }, data: audit.restore(actor), select: profileSelect })),
    );
  }
}
