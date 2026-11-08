import type {
  ChildGuardian,
  ChildGuardianWithChild,
  ChildGuardianWithGuardian,
} from "../../domain/child-guardian.entity.js";
import type { ChildGuardianReader } from "../../domain/child-guardian.reader.js";
import type { SagaChildReader } from "./saga-child.reader.js";
import type { SagaGuardianReader } from "./saga-guardian.reader.js";
import type { SagaHttpClient } from "./saga-http.client.js";
import { asRecord, sagaDate, sagaId, sagaOptionalId, sagaText } from "./saga-values.js";

// Vínculos joven–acudiente desde la API de Saga (`/children-guardians`), en solo
// lectura (ADR-007). Saga no los devuelve con los datos de la otra parte: se
// unen aquí con las listas de jóvenes o de acudientes.

/** `null` si el vínculo no tiene joven o acudiente: Saga lo permite y no se puede unir. */
const toChildGuardian = (raw: unknown): ChildGuardian | null => {
  const row = asRecord(raw, "vínculo joven–acudiente");
  const childId = sagaOptionalId(row["child_id"]);
  const guardianId = sagaOptionalId(row["guardian_id"]);
  if (childId === null || guardianId === null) return null;
  return {
    id: sagaId(row["child_guardian_id"], "child_guardian_id"),
    childId,
    guardianId,
    guardianshipTypeId: sagaText(row["guardianship_type_id"]),
    startDate: sagaDate(row["start_date"]),
    endDate: sagaDate(row["end_date"]),
  };
};

/** Más recientes primero (los vínculos sin fecha al final), como en la BD. */
const byStartDateDesc = (a: ChildGuardian, b: ChildGuardian) =>
  (b.startDate?.getTime() ?? -Infinity) - (a.startDate?.getTime() ?? -Infinity);

export class SagaChildGuardianReader implements ChildGuardianReader {
  constructor(
    private readonly saga: SagaHttpClient,
    private readonly children: SagaChildReader,
    private readonly guardians: SagaGuardianReader,
  ) {}

  async findByChild(childId: bigint, activeOnly = false): Promise<ChildGuardianWithGuardian[]> {
    const links = await this.links((link) => link.childId === childId, activeOnly);
    const guardians = new Map((await this.guardians.all()).map((guardian) => [guardian.id, guardian]));
    return links.flatMap((link) => {
      const guardian = guardians.get(link.guardianId);
      return guardian ? [{ ...link, guardian }] : [];
    });
  }

  async findByGuardian(guardianId: bigint, activeOnly = false): Promise<ChildGuardianWithChild[]> {
    const links = await this.links((link) => link.guardianId === guardianId, activeOnly);
    const children = new Map((await this.children.all()).map((child) => [child.id, child]));
    return links.flatMap((link) => {
      const child = children.get(link.childId);
      return child ? [{ ...link, child }] : [];
    });
  }

  private async links(match: (link: ChildGuardian) => boolean, activeOnly: boolean): Promise<ChildGuardian[]> {
    return (await this.saga.list("/children-guardians"))
      .map(toChildGuardian)
      .filter((link): link is ChildGuardian => link !== null && match(link) && (!activeOnly || link.endDate === null))
      .sort(byStartDateDesc);
  }
}
