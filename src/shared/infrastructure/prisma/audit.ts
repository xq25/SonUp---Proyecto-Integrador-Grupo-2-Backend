import type { ActorId, QueryOptions } from "../../domain/auditable.js";

/**
 * Auditoría y borrado lógico para los repositorios Prisma.
 *
 * La BD (trigger `auditar()`) pone siempre las fechas y protege los datos de
 * creación. Prisma se conecta sin JWT, así que `auth.uid()` es null y el
 * actor (*By) hay que enviarlo explícitamente con estas funciones.
 */
export const audit = {
  create: (actor: ActorId) => ({ createdBy: actor, updatedBy: actor }),
  update: (actor: ActorId) => ({ updatedBy: actor }),
  delete: (actor: ActorId) => ({ deletedAt: new Date(), deletedBy: actor, updatedBy: actor }),
  restore: (actor: ActorId) => ({ deletedAt: null, deletedBy: null, updatedBy: actor }),
};

/** Fragmento de `select` con las columnas de auditoría. */
export const auditSelect = {
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
} as const;

/** Filtro de registros no eliminados. */
export const notDeleted = { deletedAt: null } as const;

/** Filtro según las opciones de consulta (por defecto, solo no eliminados). */
export const deletedFilter = (options: QueryOptions = {}) => (options.includeDeleted ? {} : notDeleted);
