/** Id del perfil (= auth.users.id) que ejecuta una operación. */
export type ActorId = string;

/**
 * Base de todas las entidades. Refleja las columnas de auditoría y de
 * borrado lógico que `habilitar_auditoria()` agrega a cada tabla.
 */
export interface AuditableEntity {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  /** Borrado lógico: si no es null, el registro está eliminado. */
  deletedAt: Date | null;
  deletedBy: string | null;
}

/** Campos de una entidad que no son de auditoría. */
export type WithoutAudit<T extends AuditableEntity> = Omit<T, keyof AuditableEntity>;

export interface QueryOptions {
  /** Por defecto las consultas ignoran los registros eliminados. */
  includeDeleted?: boolean;
}

export const isDeleted = (entity: AuditableEntity): boolean => entity.deletedAt !== null;
