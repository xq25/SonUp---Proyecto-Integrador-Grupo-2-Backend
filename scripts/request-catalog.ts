// Catálogo de cuerpos de petición por operación: única fuente para
// docs/api/CUERPOS_DE_PETICION.md y docs/api/postman-casos.json.
// `npm run docs:requests` valida CADA ejemplo contra el esquema Zod real y
// falla si algún ejemplo no se comporta como dice este catálogo.
import type { z } from "zod";
import { assignRoleSchema, createCatalogSchema } from "../src/access/application/access.schemas.js";
import {
  createAdministratorSchema,
  updateAdministratorSchema,
} from "../src/administrators/application/administrator.schemas.js";
import {
  createEvaluationScaleSchema,
  evaluateSkillSchema,
  updateEvaluationScaleSchema,
} from "../src/evaluations/application/evaluation.schemas.js";
import {
  registerCredentialSchema,
  updateCredentialSchema,
  updateEvidenceSchema,
  uploadEvidenceSchema,
} from "../src/evidences/application/evidence.schemas.js";
import { updateProfileSchema } from "../src/profiles/application/profile.schemas.js";
import {
  createSkillCategorySchema,
  createSkillSchema,
  updateSkillCategorySchema,
  updateSkillSchema,
} from "../src/skills/application/skill.schemas.js";
import {
  createWorkshopSchema,
  registerAttendanceSchema,
  updateAttendanceSchema,
  updateWorkshopSchema,
} from "../src/workshops/application/workshop.schemas.js";

export interface FieldDoc {
  name: string;
  /** Tipo en el JSON del cuerpo. */
  type: string;
  required: boolean;
  rules: string;
}

export interface InvalidCase {
  name: string;
  body: unknown;
  /** Campos que deben aparecer en `details[].path` del ValidationError. */
  errorPaths: string[];
}

export interface Operation {
  id: string;
  title: string;
  feature: string;
  /** Llamada al servicio que atiende la ruta. */
  service: string;
  /**
   * Ruta HTTP (relativa a `/api/v1`, con `:param` como en Express).
   * `saveIdAs`: en Postman, el `id` de la respuesta se guarda en esa variable
   * para que las peticiones siguientes (p. ej. actualizar) usen lo recién creado.
   * `alsoAt`: otras rutas que reciben el mismo cuerpo (p. ej. `/roles` y `/apps`).
   */
  http: { method: "POST" | "PATCH"; path: string; saveIdAs?: string; alsoAt?: string[] };
  schema: z.ZodType;
  fields: FieldDoc[];
  valid: unknown;
  invalid: InvalidCase[];
  /** Reglas de negocio (nivel 2): no las valida el esquema; responden 404/409/400 desde el servicio. */
  businessRules: string[];
  /** Advertencia (p. ej. reglas aún sin revisar). */
  warning?: string;
}

const id = "número o texto con un entero > 0 (ej. 12 o \"12\")";
const iso = "texto ISO 8601 con zona (ej. \"2026-10-20T15:00:00Z\")";
const https = "URL `https://…`, sin espacios, máx. 2048";

export const operations: Operation[] = [
  // ───────────── Administrativos ─────────────
  {
    id: "administrators.create",
    title: "Crear administrativo",
    feature: "administrators",
    service: "app.administrators.create(body, actor)",
    http: { method: "POST", path: "/administrators", saveIdAs: "administratorId" },
    schema: createAdministratorSchema,
    fields: [
      { name: "fullName", type: "string", required: true, rules: "3–150; solo letras (con tildes), espacios, `'` y `-`; se quitan espacios sobrantes" },
      { name: "documentType", type: "string", required: true, rules: "`CC` | `TI` | `CE` | `PA` | `RC` | `PPT` | `NIT`" },
      { name: "documentNumber", type: "string", required: true, rules: "3–20 letras, números o `-`, sin espacios" },
      { name: "email", type: "string", required: true, rules: "email válido, máx. 254; se guarda en minúsculas" },
      { name: "phone", type: "string | null", required: false, rules: "7–15 dígitos, `+` opcional al inicio" },
      { name: "position", type: "string", required: true, rules: "2–100" },
      { name: "status", type: "string", required: false, rules: "`active` | `inactive` (por defecto `active`)" },
    ],
    valid: {
      fullName: "María José O'Neil-Pérez",
      documentType: "CC",
      documentNumber: "1020304050",
      email: "Maria.Oneil@Fundacion.test",
      phone: "+573001234567",
      position: "Coordinadora",
    },
    invalid: [
      { name: "Falta el email", body: { fullName: "Ana Gil", documentType: "CC", documentNumber: "123", position: "Aux" }, errorPaths: ["email"] },
      { name: "Nombre con dígitos y documento con espacios", body: { fullName: "Ana 2", documentType: "CC", documentNumber: "12 34", email: "a@b.co", position: "Aux" }, errorPaths: ["fullName", "documentNumber"] },
      { name: "Tipo de documento fuera del catálogo", body: { fullName: "Ana Gil", documentType: "DNI", documentNumber: "123", email: "a@b.co", position: "Aux" }, errorPaths: ["documentType"] },
      { name: "Teléfono inválido", body: { fullName: "Ana Gil", documentType: "CC", documentNumber: "123", email: "a@b.co", position: "Aux", phone: "12-34" }, errorPaths: ["phone"] },
      { name: "Campo no permitido", body: { fullName: "Ana Gil", documentType: "CC", documentNumber: "123", email: "a@b.co", position: "Aux", role: "admin" }, errorPaths: ["role"] },
    ],
    businessRules: ["`documentNumber` único → 409", "`email` único sin distinguir mayúsculas → 409"],
  },
  {
    id: "administrators.update",
    title: "Actualizar administrativo",
    feature: "administrators",
    service: "app.administrators.update(id, body, actor)",
    http: { method: "PATCH", path: "/administrators/:id" },
    schema: updateAdministratorSchema,
    fields: [{ name: "(todos)", type: "—", required: false, rules: "Los mismos campos y reglas de crear; todos opcionales. Solo se cambian los enviados" }],
    valid: { position: "Directora", status: "inactive" },
    invalid: [
      { name: "Email inválido", body: { email: "no-es-email" }, errorPaths: ["email"] },
      { name: "Estado fuera del catálogo", body: { status: "deleted" }, errorPaths: ["status"] },
    ],
    businessRules: ["El administrativo debe existir → 404", "Documento y email únicos → 409"],
  },

  // ───────────── Habilidades ─────────────
  {
    id: "skills.createCategory",
    title: "Crear categoría de habilidades",
    feature: "skills",
    service: "app.skills.createCategory(body, actor)",
    http: { method: "POST", path: "/skill-categories", saveIdAs: "skillCategoryId" },
    schema: createSkillCategorySchema,
    fields: [
      { name: "name", type: "string", required: true, rules: "2–100; se quitan espacios sobrantes" },
      { name: "description", type: "string | null", required: false, rules: "máx. 500; vacía → null" },
    ],
    valid: { name: "  Habilidades   blandas ", description: "Relación con los demás" },
    invalid: [
      { name: "Nombre de 1 carácter", body: { name: "A" }, errorPaths: ["name"] },
      { name: "Descripción de más de 500", body: { name: "Arte", description: "x".repeat(501) }, errorPaths: ["description"] },
      { name: "Sin nombre", body: { description: "algo" }, errorPaths: ["name"] },
    ],
    businessRules: ["Nombre único sin distinguir mayúsculas → 409"],
  },
  {
    id: "skills.updateCategory",
    title: "Actualizar categoría",
    feature: "skills",
    service: "app.skills.updateCategory(id, body, actor)",
    http: { method: "PATCH", path: "/skill-categories/:id" },
    schema: updateSkillCategorySchema,
    fields: [{ name: "(todos)", type: "—", required: false, rules: "`name` y `description` con las reglas de crear; opcionales" }],
    valid: { name: "Blandas" },
    invalid: [{ name: "Campo no permitido", body: { status: "active" }, errorPaths: ["status"] }],
    businessRules: ["La categoría debe existir → 404", "Nombre único → 409", "Se puede renombrar aunque tenga habilidades"],
  },
  {
    id: "skills.createSkill",
    title: "Crear habilidad",
    feature: "skills",
    service: "app.skills.createSkill(body, actor)",
    http: { method: "POST", path: "/skills", saveIdAs: "skillId" },
    schema: createSkillSchema,
    fields: [
      { name: "name", type: "string", required: true, rules: "2–100; se quitan espacios sobrantes" },
      { name: "skillCategoryId", type: "number | string", required: true, rules: id },
      { name: "status", type: "string", required: false, rules: "`active` | `inactive` (por defecto `active`)" },
    ],
    valid: { name: "Resolución de conflictos", skillCategoryId: 1 },
    invalid: [
      { name: "Categoría no numérica", body: { name: "Arte", skillCategoryId: "abc" }, errorPaths: ["skillCategoryId"] },
      { name: "Categoría negativa", body: { name: "Arte", skillCategoryId: -1 }, errorPaths: ["skillCategoryId"] },
      { name: "Estado inválido", body: { name: "Arte", skillCategoryId: 1, status: "archived" }, errorPaths: ["status"] },
    ],
    businessRules: ["La categoría debe existir → 404", "Nombre único por categoría, sin distinguir mayúsculas → 409"],
  },
  {
    id: "skills.updateSkill",
    title: "Actualizar habilidad",
    feature: "skills",
    service: "app.skills.updateSkill(id, body, actor)",
    http: { method: "PATCH", path: "/skills/:id" },
    schema: updateSkillSchema,
    fields: [{ name: "(todos)", type: "—", required: false, rules: "Los mismos de crear; opcionales" }],
    valid: { status: "inactive" },
    invalid: [{ name: "Nombre vacío", body: { name: "   " }, errorPaths: ["name"] }],
    businessRules: ["Nombre único en la categoría final → 409", "Se puede inactivar aunque esté en talleres en curso"],
  },

  // ───────────── Escalas y evaluación ─────────────
  {
    id: "evaluations.createScale",
    title: "Crear escala de evaluación",
    feature: "evaluations",
    service: "app.evaluations.createScale(body, actor)",
    http: { method: "POST", path: "/evaluation-scales", saveIdAs: "evaluationScaleId" },
    schema: createEvaluationScaleSchema,
    fields: [
      { name: "code", type: "string", required: true, rules: "1–30; solo MAYÚSCULAS, números y `_` (no se convierte: se rechaza)" },
      { name: "name", type: "string", required: true, rules: "2–100" },
      { name: "description", type: "string | null", required: false, rules: "máx. 500" },
      { name: "numValue", type: "number", required: true, rules: "0–5, máx. 2 decimales; valor de la calificación" },
      { name: "minValue", type: "number", required: true, rules: "0–5, máx. 2 decimales" },
      { name: "maxValue", type: "number", required: true, rules: "0–5, máx. 2 decimales" },
      { name: "isActive", type: "boolean", required: false, rules: "por defecto `true`" },
    ],
    valid: { code: "EN_PROCESO", name: "En proceso", numValue: 3, minValue: 2, maxValue: 3.49 },
    invalid: [
      { name: "Código en minúsculas", body: { code: "en_proceso", name: "En proceso", numValue: 3, minValue: 2, maxValue: 3.49 }, errorPaths: ["code"] },
      { name: "Valor mayor a 5", body: { code: "X", name: "Equis", numValue: 6, minValue: 2, maxValue: 3 }, errorPaths: ["numValue"] },
      { name: "Más de 2 decimales", body: { code: "X", name: "Equis", numValue: 2.555, minValue: 2, maxValue: 3 }, errorPaths: ["numValue"] },
      { name: "Valor como texto", body: { code: "X", name: "Equis", numValue: "3", minValue: 2, maxValue: 3 }, errorPaths: ["numValue"] },
    ],
    businessRules: [
      "`minValue ≤ numValue ≤ maxValue` → 400",
      "`code` único y `name` único → 409",
      "Si está activa, su intervalo no puede solaparse con otra escala activa → 409",
    ],
  },
  {
    id: "evaluations.updateScale",
    title: "Actualizar escala",
    feature: "evaluations",
    service: "app.evaluations.updateScale(id, body, actor)",
    http: { method: "PATCH", path: "/evaluation-scales/:id" },
    schema: updateEvaluationScaleSchema,
    fields: [{ name: "(todos)", type: "—", required: false, rules: "Los mismos de crear; opcionales" }],
    valid: { name: "En proceso de logro", isActive: false },
    invalid: [{ name: "Activo como texto", body: { isActive: "si" }, errorPaths: ["isActive"] }],
    businessRules: ["Si la escala ya se usó, no cambian `code`, `numValue`, `minValue` ni `maxValue` → 409", "Se valida el resultado final (valores nuevos + actuales)"],
  },
  {
    id: "evaluations.evaluate",
    title: "Evaluar una habilidad en una asistencia",
    feature: "evaluations",
    service: "app.evaluations.evaluate(body, actor)",
    http: { method: "POST", path: "/evaluations" },
    schema: evaluateSkillSchema,
    fields: [
      { name: "workshopAttendanceId", type: "number | string", required: true, rules: id },
      { name: "workshopSkillId", type: "number | string", required: true, rules: id },
      { name: "evaluationScaleId", type: "number | string", required: true, rules: id },
    ],
    valid: { workshopAttendanceId: 10, workshopSkillId: 3, evaluationScaleId: 2 },
    invalid: [
      { name: "Falta la escala", body: { workshopAttendanceId: 10, workshopSkillId: 3 }, errorPaths: ["evaluationScaleId"] },
      { name: "Id inválido", body: { workshopAttendanceId: "diez", workshopSkillId: 3, evaluationScaleId: 2 }, errorPaths: ["workshopAttendanceId"] },
    ],
    businessRules: [
      "El taller debe estar `active` → 409",
      "El estudiante no debe haber salido de la fundación → 400",
      "La habilidad debe ser del mismo taller de la asistencia → 400",
      "La escala debe estar activa → 400",
      "Reevaluar cambia la escala y recalcula la calificación",
    ],
  },

  // ───────────── Talleres y asistencia ─────────────
  {
    id: "workshops.create",
    title: "Crear taller",
    feature: "workshops",
    service: "app.workshops.create(body, actor)",
    http: { method: "POST", path: "/workshops", saveIdAs: "workshopId" },
    schema: createWorkshopSchema,
    fields: [
      { name: "evaluatorId", type: "number | string", required: true, rules: `${id}; tallerista (professional_id)` },
      { name: "name", type: "string", required: true, rules: "3–150" },
      { name: "startsAt", type: "string | null", required: false, rules: iso },
      { name: "endsAt", type: "string | null", required: false, rules: iso },
      { name: "status", type: "string", required: false, rules: "solo `planned` (todo taller nace `planned`)" },
    ],
    valid: { evaluatorId: 500, name: "Música y ritmo", startsAt: "2026-11-03T15:00:00Z" },
    invalid: [
      { name: "Nombre de 2 caracteres", body: { evaluatorId: 500, name: "AB" }, errorPaths: ["name"] },
      { name: "Crear con estado active", body: { evaluatorId: 500, name: "Música", status: "active" }, errorPaths: ["status"] },
      { name: "Fecha inválida", body: { evaluatorId: 500, name: "Música", startsAt: "mañana" }, errorPaths: ["startsAt"] },
      { name: "Varios errores", body: { evaluatorId: "x", name: "A" }, errorPaths: ["evaluatorId", "name"] },
    ],
    businessRules: ["El tallerista debe existir → 404", "`endsAt ≥ startsAt` → 400"],
  },
  {
    id: "workshops.update",
    title: "Actualizar taller / cambiar estado",
    feature: "workshops",
    service: "app.workshops.update(id, body, actor)",
    http: { method: "PATCH", path: "/workshops/:id" },
    schema: updateWorkshopSchema,
    fields: [
      { name: "evaluatorId, name, startsAt, endsAt", type: "—", required: false, rules: "Las mismas reglas de crear" },
      { name: "status", type: "string", required: false, rules: "`planned` | `active` | `finished` | `cancelled`" },
    ],
    valid: { status: "finished", endsAt: "2026-12-15T15:00:00Z" },
    invalid: [{ name: "Estado fuera del catálogo", body: { status: "archived" }, errorPaths: ["status"] }],
    businessRules: [
      "Transiciones: `planned → active → finished`; `planned`/`active → cancelled` → si no, 409",
      "Solo un taller `planned` se edita; en `active` solo cambia el estado (al finalizar puede llevar `endsAt`) → 409",
      "`active` exige `startsAt` y al menos una habilidad → 400",
      "`finished` exige `endsAt`, no anterior a la última asistencia → 400",
    ],
  },
  {
    id: "attendance.register",
    title: "Registrar asistencia",
    feature: "workshops",
    service: "app.attendance.register(body, actor)",
    http: { method: "POST", path: "/attendances", saveIdAs: "attendanceId" },
    schema: registerAttendanceSchema,
    fields: [
      { name: "studentId", type: "number | string", required: true, rules: `${id}; joven (child_id)` },
      { name: "workshopId", type: "number | string", required: true, rules: id },
      { name: "attendedAt", type: "string", required: false, rules: `${iso}; por defecto, ahora` },
      { name: "observation", type: "string | null", required: false, rules: "máx. 1000; vacía → null" },
    ],
    valid: { studentId: 1, workshopId: 2, attendedAt: "2026-10-20T15:00:00Z", observation: "Participó activamente" },
    invalid: [
      { name: "Falta el estudiante", body: { workshopId: 2 }, errorPaths: ["studentId"] },
      { name: "Observación de más de 1000", body: { studentId: 1, workshopId: 2, observation: "a".repeat(1001) }, errorPaths: ["observation"] },
      { name: "Campo no permitido", body: { studentId: 1, workshopId: 2, grade: 5 }, errorPaths: ["grade"] },
    ],
    businessRules: [
      "El taller debe estar `active` → 409",
      "El estudiante debe existir y no haber salido de la fundación → 404/400",
      "Fecha no futura y dentro de las fechas del taller → 400",
      "Una asistencia por estudiante, taller y día (hora de Bogotá) → 409",
    ],
  },
  {
    id: "attendance.update",
    title: "Actualizar asistencia",
    feature: "workshops",
    service: "app.attendance.update(id, body, actor)",
    http: { method: "PATCH", path: "/attendances/:id" },
    schema: updateAttendanceSchema,
    fields: [
      { name: "attendedAt", type: "string", required: false, rules: iso },
      { name: "observation", type: "string | null", required: false, rules: "máx. 1000; vacía → null" },
    ],
    valid: { observation: "Llegó tarde" },
    invalid: [{ name: "Fecha inválida", body: { attendedAt: "ayer" }, errorPaths: ["attendedAt"] }],
    businessRules: ["Con el taller cerrado (`finished`/`cancelled`) solo se cambia la observación → 409", "Cambiar la fecha recalcula las calificaciones"],
  },

  // ───────────── Evidencias y credenciales ─────────────
  {
    id: "evidences.upload",
    title: "Subir evidencia",
    feature: "evidences",
    service: "app.evidences.upload(body, actor)",
    http: { method: "POST", path: "/evidences", saveIdAs: "evidenceId" },
    schema: uploadEvidenceSchema,
    fields: [
      { name: "url", type: "string", required: true, rules: https },
      { name: "title", type: "string", required: true, rules: "2–150" },
      { name: "studentIds", type: "array", required: true, rules: `1–50 ids (${id}); los repetidos se cuentan una vez` },
    ],
    valid: { url: "https://storage.fundacion.test/evidencias/mural.jpg", title: "Mural colectivo", studentIds: [1, "2"] },
    invalid: [
      { name: "URL http", body: { url: "http://x.test/a.jpg", title: "Foto", studentIds: [1] }, errorPaths: ["url"] },
      { name: "URL con espacios", body: { url: "https://x.test/mi foto.jpg", title: "Foto", studentIds: [1] }, errorPaths: ["url"] },
      { name: "Sin estudiantes", body: { url: "https://x.test/a.jpg", title: "Foto", studentIds: [] }, errorPaths: ["studentIds"] },
      { name: "Id de estudiante inválido", body: { url: "https://x.test/a.jpg", title: "Foto", studentIds: [1, "x"] }, errorPaths: ["studentIds.1"] },
    ],
    businessRules: ["Cada estudiante debe existir y estar activo → 404/400"],
  },
  {
    id: "evidences.update",
    title: "Actualizar evidencia",
    feature: "evidences",
    service: "app.evidences.update(id, body, actor)",
    http: { method: "PATCH", path: "/evidences/:id" },
    schema: updateEvidenceSchema,
    fields: [{ name: "url, title", type: "string", required: false, rules: "Las mismas reglas de subir. Los estudiantes se cambian con `linkStudent`/`unlinkStudent`" }],
    valid: { title: "Mural colectivo (versión final)" },
    invalid: [{ name: "Cambiar estudiantes aquí", body: { studentIds: [1] }, errorPaths: ["studentIds"] }],
    businessRules: ["La evidencia debe existir → 404"],
  },
  {
    id: "credentials.register",
    title: "Registrar credencial",
    feature: "evidences",
    service: "app.credentials.register(body, actor)",
    http: { method: "POST", path: "/credentials", saveIdAs: "credentialId" },
    schema: registerCredentialSchema,
    fields: [
      { name: "studentId", type: "number | string", required: true, rules: id },
      { name: "organizationName", type: "string", required: true, rules: "2–150" },
      { name: "url", type: "string", required: true, rules: https },
      { name: "workshopId", type: "number | string | null", required: false, rules: id },
      { name: "status", type: "string", required: false, rules: "solo `pending` (toda credencial nace `pending`)" },
    ],
    valid: { studentId: 1, organizationName: "Fundación Asisco", url: "https://storage.fundacion.test/certificados/c-1.pdf", workshopId: 1 },
    invalid: [
      { name: "Sin URL", body: { studentId: 1, organizationName: "SENA" }, errorPaths: ["url"] },
      { name: "Registrar como valid", body: { studentId: 1, organizationName: "SENA", url: "https://x.test/c.pdf", status: "valid" }, errorPaths: ["status"] },
    ],
    businessRules: ["El estudiante debe existir → 404", "Si hay `workshopId`: taller `finished` y el estudiante con asistencia en él → 400"],
  },
  {
    id: "credentials.update",
    title: "Actualizar credencial / cambiar estado",
    feature: "evidences",
    service: "app.credentials.update(id, body, actor)",
    http: { method: "PATCH", path: "/credentials/:id" },
    schema: updateCredentialSchema,
    fields: [
      { name: "organizationName, url, workshopId", type: "—", required: false, rules: "Las mismas reglas de registrar" },
      { name: "status", type: "string", required: false, rules: "`pending` | `valid` | `revoked`" },
    ],
    valid: { status: "valid" },
    invalid: [{ name: "Estado fuera del catálogo", body: { status: "approved" }, errorPaths: ["status"] }],
    businessRules: ["Transiciones: `pending → valid | revoked`, `valid → revoked` → 409", "Solo una credencial `pending` cambia sus datos → 409"],
  },

  // ───────────── Acceso (tablas del script de login) ─────────────
  {
    id: "profiles.update",
    title: "Actualizar perfil",
    feature: "profiles",
    service: "app.profiles.update(id, body, actor)",
    http: { method: "PATCH", path: "/profiles/:id" },
    schema: updateProfileSchema,
    fields: [
      { name: "firstNames", type: "string", required: false, rules: "1–100" },
      { name: "lastNames", type: "string | null", required: false, rules: "1–100" },
      { name: "phone", type: "string | null", required: false, rules: "7–15 dígitos, `+` opcional" },
      { name: "documentType", type: "string | null", required: false, rules: "`CC` | `TI` | `CE` | `PA` | `RC` | `PPT` | `NIT`" },
      { name: "documentNumber", type: "string | null", required: false, rules: "3–20 letras, números o `-`" },
      { name: "status", type: "string", required: false, rules: "`activo` | `inactivo` | `bloqueado`" },
      { name: "dataProcessingAcceptedAt", type: "string | null", required: false, rules: iso },
    ],
    valid: { firstNames: "Ana María", phone: "+573001112233", dataProcessingAcceptedAt: "2026-10-27T15:00:00Z" },
    invalid: [{ name: "Teléfono y documento inválidos", body: { phone: "abc", documentType: "XX" }, errorPaths: ["phone", "documentType"] }],
    businessRules: ["El perfil debe existir → 404", "`documentNumber` único → 409", "Los perfiles no se crean aquí: los crea el trigger al registrarse en Supabase Auth"],
    warning: "Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.",
  },
  {
    id: "access.createCatalog",
    title: "Crear rol o aplicación",
    feature: "access",
    service: "app.access.createRole(body, actor) · app.access.createApp(body, actor)",
    http: { method: "POST", path: "/roles", alsoAt: ["/apps"] },
    schema: createCatalogSchema,
    fields: [
      { name: "code", type: "string", required: true, rules: "2–30 letras, números o `_`" },
      { name: "name", type: "string", required: true, rules: "2–100" },
    ],
    valid: { code: "coordinador", name: "Coordinación" },
    invalid: [{ name: "Código con espacios", body: { code: "mal código", name: "Malo" }, errorPaths: ["code"] }],
    businessRules: ["Código único → 409"],
    warning: "Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.",
  },
  {
    id: "access.assignRole",
    title: "Asignar rol a un usuario",
    feature: "access",
    service: "app.access.assignRole(body, actor)",
    http: { method: "POST", path: "/user-roles", saveIdAs: "userRoleId" },
    schema: assignRoleSchema,
    fields: [
      { name: "userId", type: "string", required: true, rules: "UUID (formato 8-4-4-4-12)" },
      { name: "role", type: "string", required: true, rules: "código de rol (2–30 letras, números o `_`)" },
      { name: "app", type: "string | null", required: false, rules: "código de aplicación; `null` = rol global" },
    ],
    valid: { userId: "a1b2c3d4-0000-4000-8000-000000000001", role: "tallerista", app: "aula_up" },
    invalid: [{ name: "userId no UUID", body: { userId: "123", role: "tallerista" }, errorPaths: ["userId"] }],
    businessRules: ["El perfil, el rol y la aplicación deben existir → 404", "No se repite el mismo rol con el mismo alcance → 409"],
    warning: "Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.",
  },
];

// ───────────── Rutas ─────────────

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RouteDoc {
  method: HttpMethod;
  /** Relativa a `/api/v1`, con `:param` como en Express. */
  path: string;
  description: string;
  /** Parámetros de consulta admitidos (los demás se rechazan con 400). */
  query?: string;
}

/**
 * Todas las rutas de la API. `npm run docs:requests` comprueba que esta lista
 * coincide EXACTAMENTE con las rutas registradas en Express (ni más ni menos).
 */
export const routes: RouteDoc[] = [
  { method: "GET", path: "/health", description: "Estado del servicio (única ruta sin autenticación)" },
  // Módulo administrativo (solo lectura)
  { method: "GET", path: "/children", description: "Estudiantes", query: "`statusId`, `search`" },
  { method: "GET", path: "/children/by-document/:documentNumber", description: "Estudiante por número de documento" },
  { method: "GET", path: "/children/:id", description: "Estudiante" },
  { method: "GET", path: "/children/:id/guardians", description: "Acudientes del estudiante", query: "`activeOnly` (por defecto `true`)" },
  { method: "GET", path: "/guardians", description: "Acudientes", query: "`search`" },
  { method: "GET", path: "/guardians/:id", description: "Acudiente" },
  { method: "GET", path: "/guardians/:id/children", description: "Estudiantes del acudiente", query: "`activeOnly` (por defecto `true`)" },
  { method: "GET", path: "/professionals", description: "Talleristas", query: "`timeDonor`" },
  { method: "GET", path: "/professionals/by-staff/:staffId", description: "Tallerista por `staff_id`" },
  { method: "GET", path: "/professionals/:id", description: "Tallerista" },
  // Administrativos
  { method: "GET", path: "/administrators", description: "Administrativos", query: "`status`, `search`, `includeDeleted`" },
  { method: "GET", path: "/administrators/:id", description: "Administrativo" },
  { method: "POST", path: "/administrators", description: "Crear administrativo" },
  { method: "PATCH", path: "/administrators/:id", description: "Actualizar administrativo" },
  { method: "DELETE", path: "/administrators/:id", description: "Eliminar administrativo (lógico)" },
  { method: "POST", path: "/administrators/:id/restore", description: "Restaurar administrativo" },
  // Perfiles y acceso
  { method: "GET", path: "/profiles", description: "Perfiles", query: "`status`, `search`, `includeDeleted`" },
  { method: "GET", path: "/profiles/me", description: "Perfil del usuario autenticado" },
  { method: "GET", path: "/profiles/:id", description: "Perfil (UUID)" },
  { method: "PATCH", path: "/profiles/:id", description: "Actualizar perfil" },
  { method: "DELETE", path: "/profiles/:id", description: "Eliminar perfil (lógico)" },
  { method: "POST", path: "/profiles/:id/restore", description: "Restaurar perfil" },
  { method: "GET", path: "/profiles/:userId/roles", description: "Roles del usuario", query: "`app`" },
  { method: "GET", path: "/profiles/:userId/roles/:role", description: "¿Tiene el rol? → `{ hasRole }`", query: "`app`" },
  { method: "GET", path: "/apps", description: "Aplicaciones" },
  { method: "POST", path: "/apps", description: "Crear aplicación" },
  { method: "GET", path: "/roles", description: "Roles" },
  { method: "POST", path: "/roles", description: "Crear rol" },
  { method: "POST", path: "/user-roles", description: "Asignar rol" },
  { method: "DELETE", path: "/user-roles/:id", description: "Revocar rol" },
  // Habilidades
  { method: "GET", path: "/skill-categories", description: "Categorías" },
  { method: "GET", path: "/skill-categories/:id", description: "Categoría" },
  { method: "POST", path: "/skill-categories", description: "Crear categoría" },
  { method: "PATCH", path: "/skill-categories/:id", description: "Actualizar categoría" },
  { method: "DELETE", path: "/skill-categories/:id", description: "Eliminar categoría (sin habilidades)" },
  { method: "GET", path: "/skills", description: "Habilidades", query: "`skillCategoryId`, `status`, `search`, `includeDeleted`" },
  { method: "GET", path: "/skills/:id", description: "Habilidad" },
  { method: "POST", path: "/skills", description: "Crear habilidad" },
  { method: "PATCH", path: "/skills/:id", description: "Actualizar habilidad" },
  { method: "DELETE", path: "/skills/:id", description: "Eliminar habilidad (sin historial)" },
  { method: "GET", path: "/students/:studentId/skills", description: "Calificaciones del estudiante (calculadas)" },
  { method: "GET", path: "/students/:studentId/category-averages", description: "Promedio por categoría del estudiante" },
  // Escalas y evaluaciones
  { method: "GET", path: "/evaluation-scales", description: "Escalas, ordenadas por `numValue`", query: "`activeOnly` (por defecto `true`)" },
  { method: "GET", path: "/evaluation-scales/coverage-gaps", description: "Tramos de 0–5 sin escala activa" },
  { method: "GET", path: "/evaluation-scales/classify", description: "Escala en la que cae un valor", query: "`value` (obligatorio)" },
  { method: "GET", path: "/evaluation-scales/:id", description: "Escala" },
  { method: "POST", path: "/evaluation-scales", description: "Crear escala" },
  { method: "PATCH", path: "/evaluation-scales/:id", description: "Actualizar escala" },
  { method: "DELETE", path: "/evaluation-scales/:id", description: "Eliminar escala (si nunca se usó)" },
  { method: "POST", path: "/evaluations", description: "Evaluar una habilidad en una asistencia (recalcula la calificación)" },
  { method: "GET", path: "/attendances/:attendanceId/evaluations", description: "Evaluaciones de la asistencia" },
  { method: "DELETE", path: "/attendances/:attendanceId/evaluations/:workshopSkillId", description: "Eliminar evaluación (recalcula)" },
  { method: "POST", path: "/students/:studentId/skills/:skillId/recalculate", description: "Recalcular a mano una calificación" },
  // Talleres y asistencias
  { method: "GET", path: "/workshops", description: "Talleres", query: "`evaluatorId`, `status`, `search`, `includeDeleted`" },
  { method: "GET", path: "/workshops/:id", description: "Taller" },
  { method: "POST", path: "/workshops", description: "Crear taller (nace `planned`)" },
  { method: "PATCH", path: "/workshops/:id", description: "Editar (solo `planned`) o cambiar estado" },
  { method: "DELETE", path: "/workshops/:id", description: "Eliminar taller (sin asistencias)" },
  { method: "GET", path: "/workshops/:id/skills", description: "Habilidades del taller" },
  { method: "PUT", path: "/workshops/:id/skills/:skillId", description: "Asociar habilidad (o restaurarla)" },
  { method: "DELETE", path: "/workshops/:id/skills/:skillId", description: "Quitar habilidad (recalcula)" },
  { method: "GET", path: "/workshops/:id/attendances", description: "Asistencias del taller" },
  { method: "GET", path: "/students/:studentId/attendances", description: "Asistencias del estudiante" },
  { method: "POST", path: "/attendances", description: "Registrar asistencia" },
  { method: "GET", path: "/attendances/:id", description: "Asistencia" },
  { method: "PATCH", path: "/attendances/:id", description: "Actualizar asistencia" },
  { method: "DELETE", path: "/attendances/:id", description: "Eliminar asistencia (recalcula)" },
  // Evidencias y credenciales
  { method: "POST", path: "/evidences", description: "Subir evidencia" },
  { method: "GET", path: "/evidences/:id", description: "Evidencia" },
  { method: "PATCH", path: "/evidences/:id", description: "Actualizar evidencia" },
  { method: "DELETE", path: "/evidences/:id", description: "Eliminar evidencia (y sus relaciones)" },
  { method: "GET", path: "/evidences/:id/students", description: "Estudiantes de la evidencia" },
  { method: "PUT", path: "/evidences/:id/students/:studentId", description: "Relacionar estudiante (o restaurarlo)" },
  { method: "DELETE", path: "/evidences/:id/students/:studentId", description: "Quitar estudiante (no el último)" },
  { method: "GET", path: "/students/:studentId/evidences", description: "Evidencias del estudiante" },
  { method: "POST", path: "/credentials", description: "Registrar credencial (nace `pending`)" },
  { method: "GET", path: "/credentials/:id", description: "Credencial" },
  { method: "PATCH", path: "/credentials/:id", description: "Editar (solo `pending`) o cambiar estado" },
  { method: "DELETE", path: "/credentials/:id", description: "Eliminar credencial (solo `pending`)" },
  { method: "GET", path: "/students/:studentId/credentials", description: "Credenciales del estudiante" },
];
