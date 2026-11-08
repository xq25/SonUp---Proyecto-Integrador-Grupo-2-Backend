import type { ChildReader } from "../../administrative/domain/child.reader.js";
import type { GuardianReader } from "../../administrative/domain/guardian.reader.js";
import type { ProfessionalReader } from "../../administrative/domain/professional.reader.js";
import type { StaffReader } from "../../administrative/domain/staff.reader.js";
import type { ActorLinksResolver } from "../domain/actor-links.resolver.js";
import type { ActorLinks, Principal } from "../domain/principal.entity.js";
import { ROLES } from "../domain/roles.js";

// Enlace usuario ↔ persona de Saga (ADR-008 §2.6), según el rol:
// - TALLERISTA: `staff.security_user_id` = sub → su `professional` (por `staff_id`) → professionalId.
// - ESTUDIANTE: `children.security_user_id` = sub → childId.
// - ACUDIENTE: `guardians.security_user_id` = sub → guardianId.
// Si el usuario ya trae enlaces (cabeceras de desarrollo), se usan tal cual.
// Los enlaces encontrados se guardan unos minutos; los no encontrados no, para
// que un usuario que se acaba de enlazar en Saga no tenga que esperar.

/** Tope de usuarios en caché: al superarlo se descartan los vencidos (o todo, si no basta). */
const MAX_CACHED = 1000;

const hasAny = (links: ActorLinks) =>
  links.professionalId !== undefined || links.childId !== undefined || links.guardianId !== undefined;

export class ActorLinksService implements ActorLinksResolver {
  private readonly cache = new Map<string, { links: ActorLinks; until: number }>();

  constructor(
    private readonly staff: StaffReader,
    private readonly professionals: ProfessionalReader,
    private readonly children: ChildReader,
    private readonly guardians: GuardianReader,
    /** Segundos que se reutiliza un enlace encontrado (0: sin caché). */
    private readonly cacheSeconds: number,
  ) {}

  async resolve(principal: Principal): Promise<ActorLinks> {
    if (hasAny(principal.links)) return principal.links;

    const key = `${principal.userId}|${[...principal.roles].sort().join(",")}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.until > now) return cached.links;

    const links: ActorLinks = {};
    const { userId, roles } = principal;
    if (roles.includes(ROLES.workshopLeader)) {
      const member = await this.staff.findBySecurityUserId(userId);
      const professional = member && (await this.professionals.findByStaffId(member.id));
      if (professional) links.professionalId = professional.id;
    }
    if (roles.includes(ROLES.student)) {
      const child = await this.children.findBySecurityUserId(userId);
      if (child) links.childId = child.id;
    }
    if (roles.includes(ROLES.guardian)) {
      const guardian = await this.guardians.findBySecurityUserId(userId);
      if (guardian) links.guardianId = guardian.id;
    }

    if (hasAny(links) && this.cacheSeconds > 0) {
      if (this.cache.size >= MAX_CACHED) this.prune(now);
      this.cache.set(key, { links, until: now + this.cacheSeconds * 1000 });
    }
    return links;
  }

  private prune(now: number) {
    for (const [key, entry] of this.cache) if (entry.until <= now) this.cache.delete(key);
    if (this.cache.size >= MAX_CACHED) this.cache.clear();
  }
}
