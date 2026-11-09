// Códigos de rol del servicio de seguridad (ADR-008): llegan en el token y son
// los únicos valores válidos. ADMIN accede a todo; los demás, según la matriz
// de `src/shared/http/route-permissions.ts` y la política de acceso a lo propio.

export const ROLES = {
  /** Administración: acceso total. */
  admin: "ADMIN",
  /** Tallerista: gestiona sus talleres, asistencias, evaluaciones, evidencias y certificados. */
  workshopLeader: "TALLERISTA",
  /** Joven: ve los talleres disponibles y lo suyo (historial, calificaciones, evidencias, certificados). */
  student: "ESTUDIANTE",
  /** Acudiente: ve los talleres disponibles y lo de sus jóvenes. */
  guardian: "ACUDIENTE",
  /** Donante: aún sin acceso a este módulo. */
  donor: "DONANTE",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];
