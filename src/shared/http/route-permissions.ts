import { ROLES } from "../../auth/domain/roles.js";

// Matriz ruta → roles permitidos (ADR-008). ÚNICO lugar donde se decide QUÉ ROL
// entra a cada ruta protegida: ajustarla aquí y regenerar la documentación
// (`npm run docs:requests` falla si una ruta protegida no está en la matriz).
// A QUÉ REGISTROS accede cada uno dentro de la ruta ("lo suyo") lo decide
// `AccessPolicy` (src/auth/application/access-policy.ts).
// Las rutas públicas (`/health`, `/auth/*`) se montan antes de `authenticate`
// y no pasan por aquí. DONANTE aún no tiene acceso a este módulo.

export { ROLES };

const { admin, workshopLeader, student, guardian } = ROLES;
/** Solo administración. */
const ADMIN = [admin];
/** Administración y talleristas (en sus talleres, si la ruta es de un taller). */
const LEADERS = [admin, workshopLeader];
/** También jóvenes y acudientes, limitados a lo suyo. */
const EVERYONE = [admin, workshopLeader, student, guardian];
/** Administración y el acudiente mismo. */
const FAMILY = [admin, guardian];

export const ROUTE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  // ── Módulo administrativo (Saga, solo lectura) ──
  // El tallerista ve los datos de todos los jóvenes (con anamnesis) para tenerlos en cuenta al evaluar.
  "GET /children": LEADERS,
  "GET /children/by-document/:documentNumber": LEADERS,
  "GET /children/:id": EVERYONE,
  "GET /children/:id/guardians": EVERYONE,
  "GET /guardians": ADMIN,
  "GET /guardians/:id": FAMILY,
  "GET /guardians/:id/children": FAMILY,
  // El tallerista consulta solo su propio perfil (su staff y su professional).
  "GET /professionals": ADMIN,
  "GET /professionals/by-staff/:staffId": LEADERS,
  "GET /professionals/:id": LEADERS,
  "GET /staff": ADMIN,
  "GET /staff/:id": LEADERS,

  // ── Cuentas y acceso heredados del script de login ──
  "GET /profiles": ADMIN,
  "GET /profiles/me": ADMIN,
  "GET /profiles/:id": ADMIN,
  "PATCH /profiles/:id": ADMIN,
  "DELETE /profiles/:id": ADMIN,
  "POST /profiles/:id/restore": ADMIN,
  "GET /profiles/:userId/roles": ADMIN,
  "GET /profiles/:userId/roles/:role": ADMIN,
  "GET /apps": ADMIN,
  "POST /apps": ADMIN,
  "GET /roles": ADMIN,
  "POST /roles": ADMIN,
  "POST /user-roles": ADMIN,
  "DELETE /user-roles/:id": ADMIN,

  // ── Árbol de habilidades: lo define la administración; los talleristas lo consultan ──
  // Jóvenes y acudientes ven sus habilidades por categoría en /students/:studentId/skills.
  "GET /skill-categories": LEADERS,
  "GET /skill-categories/:id": LEADERS,
  "POST /skill-categories": ADMIN,
  "PATCH /skill-categories/:id": ADMIN,
  "DELETE /skill-categories/:id": ADMIN,
  "GET /skills": LEADERS,
  "GET /skills/:id": LEADERS,
  "POST /skills": ADMIN,
  "PATCH /skills/:id": ADMIN,
  "DELETE /skills/:id": ADMIN,
  // Las escalas son la leyenda de los niveles (sin datos personales): las lee cualquier rol.
  "GET /evaluation-scales": EVERYONE,
  "GET /evaluation-scales/coverage-gaps": LEADERS,
  "GET /evaluation-scales/classify": LEADERS,
  "GET /evaluation-scales/:id": EVERYONE,
  "POST /evaluation-scales": ADMIN,
  "PATCH /evaluation-scales/:id": ADMIN,
  "DELETE /evaluation-scales/:id": ADMIN,

  // ── Talleres: el tallerista publica y gestiona los suyos; jóvenes y acudientes ven los disponibles ──
  "GET /workshops": EVERYONE,
  "GET /workshops/:id": EVERYONE,
  "POST /workshops": LEADERS,
  "PATCH /workshops/:id": LEADERS,
  "DELETE /workshops/:id": LEADERS,
  "GET /workshops/:id/skills": EVERYONE,
  "PUT /workshops/:id/skills/:skillId": LEADERS,
  "DELETE /workshops/:id/skills/:skillId": LEADERS,

  // ── Asistencias y evaluaciones: las toma el tallerista en sus talleres; el joven ve las suyas ──
  "GET /workshops/:id/attendances": LEADERS,
  "GET /students/:studentId/attendances": EVERYONE,
  "POST /attendances": LEADERS,
  "GET /attendances/:id": EVERYONE,
  "PATCH /attendances/:id": LEADERS,
  "DELETE /attendances/:id": LEADERS,
  "POST /evaluations": LEADERS,
  "GET /attendances/:attendanceId/evaluations": EVERYONE,
  "DELETE /attendances/:attendanceId/evaluations/:workshopSkillId": LEADERS,
  "POST /students/:studentId/skills/:skillId/recalculate": ADMIN,
  "GET /students/:studentId/skills": EVERYONE,
  "GET /students/:studentId/category-averages": EVERYONE,

  // ── Evidencias: las suben administración y talleristas; jóvenes y acudientes ven las suyas ──
  "POST /evidences": LEADERS,
  "GET /evidences/:id": EVERYONE,
  "PATCH /evidences/:id": LEADERS,
  "DELETE /evidences/:id": LEADERS,
  "GET /evidences/:id/students": EVERYONE,
  "PUT /evidences/:id/students/:studentId": LEADERS,
  "DELETE /evidences/:id/students/:studentId": LEADERS,
  "GET /students/:studentId/evidences": EVERYONE,

  // ── Certificados: los suben y retiran administración y talleristas; jóvenes y acudientes ven los suyos ──
  "POST /credentials": LEADERS,
  "GET /credentials/:id": EVERYONE,
  "PATCH /credentials/:id": LEADERS,
  "DELETE /credentials/:id": LEADERS,
  "GET /students/:studentId/credentials": EVERYONE,
};
