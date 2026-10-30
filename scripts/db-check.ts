// Verificación de conexión a la BD (de pruebas del módulo o general).
// Uso: npm run db:check
//
// Solo LEE: no crea ni modifica datos. Comprueba que:
//   1. DATABASE_URL está configurada y la BD responde.
//   2. Nuestro SQL está aplicado (tablas, catálogos semilla, triggers de auditoría).
//   3. Las tablas del módulo administrativo se pueden leer (simuladas en pruebas).
//   4. (Opcional) El perfil DB_CHECK_ACTOR existe, para usarlo como `actor`.
import "dotenv/config";
import { createContainer } from "../src/container.js";

const url = process.env["DATABASE_URL"];
if (!url) fail("DATABASE_URL no está definida en .env");
if (url.includes("[YOUR-PASSWORD]")) fail("Reemplaza [YOUR-PASSWORD] en .env por la contraseña de la BD");

const host = new URL(url).host;
console.log(`Conectando a ${host} …\n`);

const app = createContainer();
let failures = 0;

async function check(label: string, run: () => Promise<string>): Promise<void> {
  try {
    console.log(`  ✔ ${label}: ${await run()}`);
  } catch (error) {
    failures++;
    // En los errores de Prisma la causa está en la última línea con texto.
    const message = error instanceof Error ? error.message : String(error);
    const cause = message.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) ?? "error sin mensaje";
    console.log(`  ✘ ${label}: ${cause}`);
  }
}

console.log("Conexión");
await check("BD responde", async () => {
  const [row] = await app.prisma.$queryRaw<{ db: string; version: string }[]>`
    select current_database() as db, split_part(version(), ' ', 2) as version`;
  return `${row?.db} (PostgreSQL ${row?.version})`;
});

console.log("\nNuestro esquema (database/asisco_login_supabase.sql)");
await check("Aplicaciones", async () => `${(await app.apps.list()).length} (semilla: 8)`);
await check("Roles", async () => `${(await app.roles.list()).length} (semilla: 8)`);
await check("Escalas de evaluación", async () => `${(await app.evaluationScales.list(false)).length}`);
await check("Talleres", async () => `${(await app.workshops.list()).length}`);
await check("Triggers de auditoría y borrado lógico", async () => {
  const [row] = await app.prisma.$queryRaw<{ n: number }[]>`
    select count(*)::int as n from information_schema.triggers
    where trigger_schema = 'public' and trigger_name in ('auditar', 'borrado_logico')`;
  const n = row?.n ?? 0;
  if (n === 0) throw new Error("no hay triggers: ¿se ejecutó el SQL del módulo?");
  return `${n} (esperado: 48 = 16 tablas × 3)`;
});

console.log("\nMódulo administrativo (solo lectura)");
await check("Jóvenes (children)", async () => `${(await app.children.list()).length}`);
await check("Acudientes (guardians)", async () => `${(await app.guardians.list()).length}`);
await check("Talleristas (professionals)", async () => `${(await app.professionals.list()).length}`);

const actor = process.env["DB_CHECK_ACTOR"];
if (actor) {
  console.log("\nActor");
  await check("Perfil DB_CHECK_ACTOR", async () => {
    const profile = await app.profiles.get(actor);
    return `${profile.firstNames || "(sin nombre)"} · estado ${profile.status}`;
  });
}

await app.prisma.$disconnect();
console.log(failures === 0 ? "\nTodo en orden." : `\n${failures} verificación(es) fallaron.`);
process.exit(failures === 0 ? 0 : 1);

function fail(message: string): never {
  console.error(`✘ ${message}`);
  process.exit(1);
}
