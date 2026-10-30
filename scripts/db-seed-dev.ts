// Datos de prueba para la BD de PRUEBAS del módulo (consumo y pruebas manuales).
// Uso: npm run db:seed:dev
//
// - Usa los SERVICIOS del módulo (no SQL directo): cada registro pasa por las
//   validaciones y reglas de negocio reales, queda auditado con el actor y las
//   calificaciones (student_skills) se calculan solas al evaluar.
// - Solo corre si la BD tiene los datos simulados del módulo administrativo
//   (database/dev/administrativo_simulado.sql). En la BD general no existen,
//   así que allí se niega a correr.
// - Idempotente: busca cada registro antes de crearlo; se puede repetir sin duplicar.
// - Actor: el UUID de DB_CHECK_ACTOR (un usuario de Supabase Auth con perfil).
import "dotenv/config";
import { createContainer } from "../src/container.js";
import type { EvaluationScale } from "../src/evaluations/index.js";
import type { Skill } from "../src/skills/index.js";
import type { WorkshopSkill } from "../src/workshops/index.js";

const actor = process.env["DB_CHECK_ACTOR"];
if (!actor) fail("Define DB_CHECK_ACTOR en .env (UUID de un usuario de Supabase Auth)");

const app = createContainer();
const created: Record<string, number> = {};
const count = (what: string) => (created[what] = (created[what] ?? 0) + 1);

/** 10:00 a. m. en Bogotá (15:00 UTC) del día indicado. */
const bogota = (day: string) => new Date(`${day}T15:00:00Z`);

try {
  await ensureTestDatabase();
  await app.profiles.get(actor); // el actor debe tener perfil

  // ── Habilidades ──
  const categoryDefs = {
    Socioemocional: {
      description: "Relación consigo mismo y con los demás",
      skills: ["Trabajo en equipo", "Comunicación asertiva", "Manejo de emociones"],
    },
    Artística: {
      description: "Expresión a través del arte",
      skills: ["Expresión musical", "Expresión corporal", "Creatividad"],
    },
    Cognitiva: {
      description: "Procesos de pensamiento y aprendizaje",
      skills: ["Atención", "Resolución de problemas"],
    },
  } as const;

  const skills = new Map<string, Skill>();
  for (const [categoryName, def] of Object.entries(categoryDefs)) {
    const category =
      (await app.skillCategories.list()).find((c) => c.name === categoryName) ??
      (count("categorías"), await app.skillCategories.create({ name: categoryName, description: def.description }, actor));
    for (const skillName of def.skills) {
      const skill =
        (await app.skills.list({ skillCategoryId: category.id })).find((s) => s.name === skillName) ??
        (count("habilidades"), await app.skills.create({ name: skillName, skillCategoryId: category.id }, actor));
      skills.set(skillName, skill);
    }
  }

  // ── Escalas: cubren todo el rango 0–5, sin huecos ──
  const scaleDefs = [
    { code: "BAJO", name: "Bajo", numValue: 1, minValue: 0, maxValue: 1.99, description: "Requiere acompañamiento" },
    { code: "BASICO", name: "Básico", numValue: 2.5, minValue: 2, maxValue: 2.99, description: "Avance inicial" },
    { code: "ALTO", name: "Alto", numValue: 3.5, minValue: 3, maxValue: 3.99, description: "Buen desempeño" },
    { code: "SUPERIOR", name: "Superior", numValue: 4.5, minValue: 4, maxValue: 5, description: "Dominio de la habilidad" },
  ];
  const scales: EvaluationScale[] = [];
  for (const def of scaleDefs) {
    const existing = (await app.evaluationScales.list(false)).find((s) => s.code === def.code);
    scales.push(existing ?? (count("escalas"), await app.evaluationScales.create(def, actor)));
  }

  // ── Administrativos (provisional) ──
  const adminDefs = [
    { fullName: "Carolina Restrepo", documentType: "CC", documentNumber: "43100200", email: "coordinacion@fundacion.test", phone: "+573001234567", position: "Coordinadora académica" },
    { fullName: "Andrés Gómez", documentType: "CC", documentNumber: "71300400", email: "comunicaciones@fundacion.test", position: "Comunicaciones" },
  ] as const;
  for (const def of adminDefs) {
    const exists = (await app.administrators.list({ search: def.documentNumber, includeDeleted: true })).length > 0;
    if (!exists) {
      count("administrativos");
      await app.administrators.create(def, actor);
    }
  }

  // ── Talleres con asistencias y evaluaciones ──
  // Estudiantes activos del simulado: 1, 2, 4, 5 (el 3 ya salió de la fundación).
  // Talleristas simulados: 500 (música), 501 (psicología), 502 (artes plásticas).
  const workshopDefs = [
    {
      name: "Música y ritmo",
      evaluatorId: 500n,
      skills: ["Expresión musical", "Trabajo en equipo", "Atención"],
      sessions: ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25", "2026-09-01"],
      students: [1n, 2n, 4n, 5n],
      endsAt: "2026-09-05", // se finaliza
    },
    {
      name: "Teatro y expresión",
      evaluatorId: 501n,
      skills: ["Expresión corporal", "Comunicación asertiva", "Manejo de emociones"],
      sessions: ["2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06"],
      students: [1n, 2n, 5n],
      endsAt: null, // sigue activo
    },
    {
      name: "Pintura creativa",
      evaluatorId: 502n,
      skills: ["Creatividad", "Resolución de problemas"],
      sessions: ["2026-10-13", "2026-10-20"],
      students: [2n, 4n],
      endsAt: null,
    },
  ];

  for (const def of workshopDefs) {
    if ((await app.workshops.list({ search: def.name, includeDeleted: true })).some((w) => w.name === def.name)) continue;
    count("talleres");
    const workshop = await app.workshops.create(
      { evaluatorId: def.evaluatorId, name: def.name, startsAt: bogota(def.sessions[0]!) },
      actor,
    );
    const workshopSkills: WorkshopSkill[] = [];
    for (const skillName of def.skills) workshopSkills.push(await app.workshopSkills.add(workshop.id, skills.get(skillName)!.id, actor));
    await app.workshops.update(workshop.id, { status: "active" }, actor);

    for (const [sessionIndex, day] of def.sessions.entries()) {
      for (const studentId of def.students) {
        // Algunas inasistencias, para que no todos tengan las mismas sesiones.
        if (hash(`${def.name}|${studentId}|${day}`) % 6 === 0) continue;
        count("asistencias");
        const attendance = await app.attendance.register(
          { studentId, workshopId: workshop.id, attendedAt: bogota(day), observation: sessionIndex === 0 ? "Primera sesión" : null },
          actor,
        );
        for (const workshopSkill of workshopSkills) {
          count("evaluaciones");
          await app.evaluations.evaluate(
            {
              workshopAttendanceId: attendance.id,
              workshopSkillId: workshopSkill.id,
              evaluationScaleId: pickScale(scales, `${studentId}|${workshopSkill.skillId}|${sessionIndex}`, sessionIndex).id,
            },
            actor,
          );
        }
      }
    }
    if (def.endsAt) await app.workshops.update(workshop.id, { status: "finished", endsAt: bogota(def.endsAt) }, actor);
  }

  // ── Evidencias ──
  const evidenceDefs = [
    { title: "Presentación final de Música y ritmo", url: "https://storage.fundacion.test/evidencias/musica-final.mp4", studentIds: [1n, 2n, 4n] },
    { title: "Ensayo de la obra de teatro", url: "https://storage.fundacion.test/evidencias/teatro-ensayo.jpg", studentIds: [1n, 5n] },
    { title: "Mural colectivo", url: "https://storage.fundacion.test/evidencias/mural.jpg", studentIds: [2n, 4n] },
  ];
  for (const def of evidenceDefs) {
    const already = (await app.studentEvidences.listByStudent(def.studentIds[0]!)).some((e) => e.evidence.title === def.title);
    if (!already) {
      count("evidencias");
      await app.evidences.upload(def, actor);
    }
  }

  // ── Credenciales (taller "Música y ritmo" ya finalizado) ──
  const music = (await app.workshops.list({ search: "Música y ritmo" })).find((w) => w.name === "Música y ritmo");
  const credentialDefs = [
    { studentId: 1n, organizationName: "Fundación Asisco", url: "https://storage.fundacion.test/certificados/musica-1.pdf", validate: true },
    { studentId: 2n, organizationName: "Fundación Asisco", url: "https://storage.fundacion.test/certificados/musica-2.pdf", validate: false },
  ];
  for (const def of credentialDefs) {
    if (!music) break;
    const already = (await app.credentials.listByStudent(def.studentId)).some((c) => c.url === def.url);
    if (already) continue;
    count("credenciales");
    const credential = await app.credentials.register(
      { studentId: def.studentId, organizationName: def.organizationName, url: def.url, workshopId: music.id },
      actor,
    );
    if (def.validate) await app.credentials.update(credential.id, { status: "valid" }, actor);
  }

  // ── Resumen ──
  console.log("Registros creados en esta ejecución:");
  const lines = Object.entries(created);
  console.log(lines.length ? lines.map(([k, v]) => `  · ${k}: ${v}`).join("\n") : "  (ninguno: los datos de prueba ya existían)");

  const names = new Map(scales.map((s) => [s.id, s.name]));
  const skillNames = new Map([...skills.values()].map((s) => [s.id, s.name]));
  console.log("\nEjemplo de consumo — calificaciones del estudiante 1 (Leo Paz):");
  for (const grade of await app.studentSkills.listByStudent(1n)) {
    console.log(`  · ${skillNames.get(grade.skillId) ?? grade.skillId}: ${names.get(grade.evaluationScaleId) ?? grade.evaluationScaleId}`);
  }
  for (const avg of await app.studentSkills.getCategoryAverages(1n)) {
    console.log(`  · Promedio ${avg.categoryName}: ${avg.average} (${avg.skillCount} habilidades) → ${avg.evaluationScaleId ? names.get(avg.evaluationScaleId) : "sin escala"}`);
  }
} catch (error) {
  console.error(`\n✘ El seed se detuvo: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await app.prisma.$disconnect();
}

/** Protección: solo se siembra la BD de pruebas (la que tiene el simulado del módulo administrativo). */
async function ensureTestDatabase() {
  const leo = await app.children.get(1n).catch(() => null);
  const musicTeacher = await app.professionals.findByStaffId(77n);
  if (leo?.documentNumber !== "TI-1001" || leo.firstName !== "Leo" || musicTeacher?.id !== 500n) {
    fail(
      "Esta BD no tiene los datos simulados del módulo administrativo: " +
        "el seed solo corre en la BD de pruebas (ejecuta antes database/dev/administrativo_simulado.sql).",
    );
  }
  console.log(`Sembrando la BD de pruebas en ${new URL(process.env["DATABASE_URL"]!).host} …\n`);
}

/**
 * Escala de una evaluación, determinista para que el seed sea reproducible.
 * Tiende a mejorar con las sesiones, como un progreso real.
 */
function pickScale(scales: EvaluationScale[], key: string, sessionIndex: number): EvaluationScale {
  const sorted = [...scales].sort((a, b) => a.numValue - b.numValue);
  const base = (hash(key) % 3) + (sessionIndex >= 3 ? 1 : 0); // 0..3
  return sorted[Math.min(base, sorted.length - 1)]!;
}

/** Hash simple y estable de un texto (FNV-1a). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fail(message: string): never {
  console.error(`✘ ${message}`);
  process.exit(1);
}
