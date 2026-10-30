import type { ActorId } from "../../shared/domain/auditable.js";
import { audit, auditSelect, notDeleted } from "../../shared/infrastructure/prisma/audit.js";
import { decimalToNumber } from "../../shared/infrastructure/prisma/mappers.js";
import { withPrismaErrors } from "../../shared/infrastructure/prisma/prisma-errors.js";
import type { Prisma, PrismaClient } from "../../shared/infrastructure/prisma/prisma.client.js";
import type {
  CreateEvaluationScaleInput,
  EvaluationScale,
  UpdateEvaluationScaleInput,
} from "../domain/evaluation-scale.entity.js";
import type { EvaluationScaleRepository } from "../domain/evaluation-scale.repository.js";

const scaleSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  numValue: true,
  minValue: true,
  maxValue: true,
  isActive: true,
  ...auditSelect,
} satisfies Prisma.EvaluationScaleSelect;

type ScaleRow = Prisma.EvaluationScaleGetPayload<{ select: typeof scaleSelect }>;

// numeric(5,2) llega como Decimal: en el dominio se maneja como number.
const toScale = (row: ScaleRow): EvaluationScale => ({
  ...row,
  numValue: decimalToNumber(row.numValue),
  minValue: decimalToNumber(row.minValue),
  maxValue: decimalToNumber(row.maxValue),
});

const activeScale = { ...notDeleted, isActive: true } as const;

export class PrismaEvaluationScaleRepository implements EvaluationScaleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: bigint): Promise<EvaluationScale | null> {
    const row = await this.prisma.evaluationScale.findFirst({ where: { id, ...notDeleted }, select: scaleSelect });
    return row && toScale(row);
  }

  async findByCode(code: string): Promise<EvaluationScale | null> {
    const row = await this.prisma.evaluationScale.findUnique({ where: { code }, select: scaleSelect });
    return row && toScale(row);
  }

  async findByName(name: string): Promise<EvaluationScale | null> {
    // Igual que el índice único de la BD: lower(name).
    const row = await this.prisma.evaluationScale.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: scaleSelect,
    });
    return row && toScale(row);
  }

  async isInUse(id: bigint): Promise<boolean> {
    const [evaluation, grade] = await Promise.all([
      this.prisma.evaluationSkill.findFirst({ where: { evaluationScaleId: id, ...notDeleted }, select: { id: true } }),
      this.prisma.studentSkill.findFirst({ where: { evaluationScaleId: id, ...notDeleted }, select: { id: true } }),
    ]);
    return evaluation !== null || grade !== null;
  }

  async findAll(activeOnly = true): Promise<EvaluationScale[]> {
    const rows = await this.prisma.evaluationScale.findMany({
      where: activeOnly ? activeScale : notDeleted,
      select: scaleSelect,
      orderBy: { numValue: "asc" },
    });
    return rows.map(toScale);
  }

  async findByValue(value: number): Promise<EvaluationScale | null> {
    const row = await this.prisma.evaluationScale.findFirst({
      where: { ...activeScale, minValue: { lte: value }, maxValue: { gte: value } },
      select: scaleSelect,
    });
    return row && toScale(row);
  }

  async findOverlapping(minValue: number, maxValue: number, excludeId?: bigint): Promise<EvaluationScale[]> {
    // Dos intervalos inclusivos se solapan si cada uno empieza antes de que el otro termine.
    const where: Prisma.EvaluationScaleWhereInput = {
      ...activeScale,
      minValue: { lte: maxValue },
      maxValue: { gte: minValue },
    };
    if (excludeId !== undefined) where.id = { not: excludeId };
    const rows = await this.prisma.evaluationScale.findMany({ where, select: scaleSelect, orderBy: { numValue: "asc" } });
    return rows.map(toScale);
  }

  create(data: CreateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale> {
    return withPrismaErrors("Escala de evaluación", async () =>
      toScale(await this.prisma.evaluationScale.create({ data: { ...data, ...audit.create(actor) }, select: scaleSelect })),
    );
  }

  update(id: bigint, data: UpdateEvaluationScaleInput, actor: ActorId): Promise<EvaluationScale> {
    return withPrismaErrors("Escala de evaluación", async () =>
      toScale(
        await this.prisma.evaluationScale.update({
          where: { id },
          data: { ...data, ...audit.update(actor) },
          select: scaleSelect,
        }),
      ),
    );
  }

  async delete(id: bigint, actor: ActorId): Promise<void> {
    await withPrismaErrors("Escala de evaluación", () =>
      this.prisma.evaluationScale.update({ where: { id }, data: audit.delete(actor), select: { id: true } }),
    );
  }
}
