// Genera la documentación de la API y la colección de Postman desde scripts/request-catalog.ts.
// Uso: npm run docs:requests
//
// 1. Comprobaciones (si alguna falla, no escribe nada y termina con error):
//    - cada cuerpo válido pasa `parseInput` (el mismo que usan los servicios);
//    - cada cuerpo inválido falla EXACTAMENTE en los campos declarados;
//    - la lista `routes` coincide con las rutas registradas en Express, y cada
//      operación con cuerpo apunta a una ruta existente.
// 2. Escribe:
//    - docs/api/CUERPOS_DE_PETICION.md: rutas, cuerpos y reglas (para leer);
//    - docs/api/postman-coleccion.json: colección de Postman v2.1, una carpeta por entidad, con pruebas;
//    - docs/api/postman-casos.json: los casos de cuerpo como archivo de datos;
//    - src/docs/api-routes.yaml: las rutas en OpenAPI, para Swagger UI (ADR-005).
import { mkdirSync, writeFileSync } from "node:fs";
import type { Container } from "../src/container.js";
import { z } from "zod";
import { API_PREFIX } from "../src/shared/http/api.routes.js";
import { createApp } from "../src/shared/http/app.js";
import { parseInput } from "../src/shared/application/validation.js";
import { ValidationError } from "../src/shared/domain/errors.js";
import { type Operation, operations, type RouteDoc, routes } from "./request-catalog.js";

const problems: string[] = [];

// ── 1a. Cuerpos contra los esquemas Zod ──

function errorPathsOf(op: Operation, body: unknown): string[] | null {
  try {
    parseInput(op.schema, body, op.id);
    return null;
  } catch (error) {
    if (error instanceof ValidationError) return error.details.map((d) => d.path);
    throw error;
  }
}

for (const op of operations) {
  const validPaths = errorPathsOf(op, op.valid);
  if (validPaths) problems.push(`${op.id} · el cuerpo válido falla en: ${validPaths.join(", ")}`);
  for (const c of op.invalid) {
    const paths = errorPathsOf(op, c.body);
    const expected = [...c.errorPaths].sort().join(",");
    const actual = paths ? [...paths].sort().join(",") : "(pasó)";
    if (actual !== expected) problems.push(`${op.id} · "${c.name}": esperado [${expected}], obtenido [${actual}]`);
  }
}

// ── 1b. Rutas documentadas contra las registradas en Express ──

/** Recorre la pila de Express (los routers de cada feature se montan sin prefijo dentro de /api). */
function registeredRoutes(): string[] {
  // Solo se registran las rutas: los servicios no se llaman, así que el contenedor puede ir vacío.
  const app = createApp({} as Container, { allowDevHeader: true });
  const found: string[] = [];
  type Layer = { route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: Layer[] } };
  const walk = (stack: Layer[]) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) found.push(`${method.toUpperCase()} ${layer.route.path}`);
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack);
      }
    }
  };
  walk((app as unknown as { router: { stack: Layer[] } }).router.stack);
  return found;
}

const key = (method: string, path: string) => `${method} ${path}`;
const registered = new Set(registeredRoutes());
const documented = new Set(routes.map((r) => key(r.method, r.path)));
for (const r of registered) if (!documented.has(r)) problems.push(`Ruta registrada sin documentar: ${r}`);
for (const r of documented) if (!registered.has(r)) problems.push(`Ruta documentada que no existe: ${r}`);

/** Rutas con cuerpo → su operación del catálogo. */
const opByRoute = new Map<string, Operation>();
for (const op of operations) {
  const { method, path } = op.http;
  if (!registered.has(key(method, path))) problems.push(`${op.id} · su ruta ${method} ${path} no existe`);
  opByRoute.set(key(method, path), op);
}
// Un PATCH siempre lleva cuerpo: debe estar en el catálogo.
for (const r of routes) {
  if (r.method === "PATCH" && !opByRoute.has(key(r.method, r.path))) problems.push(`PATCH ${r.path} sin cuerpos en el catálogo`);
}

// ── 1c. Entidad de cada ruta (carpetas de Postman) ──

/** Carpetas en orden de ejecución: primero lo que otras entidades usan. La primera regla que coincide gana. */
const entities: { name: string; match: RegExp }[] = [
  { name: "Estado", match: /^\/health$/ },
  { name: "Autenticación", match: /^\/auth\// },
  { name: "Estudiantes", match: /^\/children/ },
  { name: "Acudientes", match: /^\/guardians/ },
  { name: "Talleristas", match: /^\/professionals/ },
  { name: "Administrativos", match: /^\/administrators/ },
  { name: "Acceso (roles y aplicaciones)", match: /^\/(apps|roles|user-roles)|^\/profiles\/:userId\/roles/ },
  { name: "Perfiles", match: /^\/profiles/ },
  { name: "Categorías de habilidades", match: /^\/skill-categories/ },
  { name: "Habilidades", match: /^\/skills/ },
  { name: "Escalas de evaluación", match: /^\/evaluation-scales/ },
  { name: "Talleres", match: /^\/workshops/ },
  { name: "Asistencias", match: /^\/attendances(\/:id)?$|^\/students\/:studentId\/attendances/ },
  { name: "Evaluaciones y calificaciones", match: /^\/evaluations|\/evaluations|^\/students\/:studentId\/(skills|category-averages)/ },
  { name: "Evidencias", match: /^\/evidences|^\/students\/:studentId\/evidences/ },
  { name: "Credenciales", match: /^\/credentials|^\/students\/:studentId\/credentials/ },
];
const entityOf = (path: string) => entities.find((e) => e.match.test(path))?.name;
for (const r of routes) if (!entityOf(r.path)) problems.push(`Ruta sin entidad para Postman: ${r.method} ${r.path}`);

if (problems.length > 0) {
  console.error("✘ El catálogo no coincide con los esquemas o las rutas:\n" + problems.map((p) => `  · ${p}`).join("\n"));
  process.exit(1);
}

// ── Variables de Postman ──

/** Valores por defecto: ids de la BD de pruebas (`npm run db:seed:dev` y el simulado administrativo). */
const variables: Record<string, string> = {
  baseUrl: `http://localhost:3000${API_PREFIX}`,
  actorId: "",
  token: "",
  /** Token del login del módulo administrativo (lo llena "Iniciar sesión"); lo usa GET /auth/profile. */
  authToken: "",
  /** `true` para que el registro válido cree de verdad el usuario en el módulo administrativo. */
  runExternalWrites: "false",
  /** Perfil que se modifica o elimina. Vacío = esas peticiones se omiten (para no tocar el propio perfil). */
  profileId: "",
  studentId: "1",
  guardianId: "10",
  professionalId: "500",
  staffId: "77",
  documentNumber: "TI-1001",
  administratorId: "1",
  skillCategoryId: "1",
  skillId: "1",
  evaluationScaleId: "1",
  workshopId: "1",
  workshopSkillId: "1",
  attendanceId: "1",
  evidenceId: "1",
  credentialId: "1",
  userRoleId: "1",
  role: "administrador",
  classifyValue: "3.2",
};

/** Peticiones sin cuerpo que también crean algo cuyo id se guarda. */
const actionSaves: Record<string, string> = { "PUT /workshops/:id/skills/:skillId": "workshopSkillId" };

/** Variables que la colección llena al crear: las escrituras sobre registros existentes solo usan ids creados por ella. */
const creatableVariables = new Set([
  ...operations.flatMap((op) => (op.http.saveIdAs ? [op.http.saveIdAs] : [])),
  ...Object.values(actionSaves),
]);

/** Variable que llena `:id` según el recurso (primer segmento de la ruta). */
const idVariableByResource: Record<string, string> = {
  children: "studentId",
  guardians: "guardianId",
  professionals: "professionalId",
  administrators: "administratorId",
  profiles: "actorId",
  "skill-categories": "skillCategoryId",
  skills: "skillId",
  "evaluation-scales": "evaluationScaleId",
  workshops: "workshopId",
  attendances: "attendanceId",
  evidences: "evidenceId",
  credentials: "credentialId",
  "user-roles": "userRoleId",
};
/** Variable para el resto de parámetros (el nombre del parámetro, salvo excepciones). */
const variableByParam: Record<string, string> = { userId: "actorId" };

/** Ruta con variables de Postman. `writes`: la petición modifica un registro existente. */
function postmanPath(path: string, writes = false): string {
  const resource = path.split("/")[1] ?? "";
  return path.replace(/:(\w+)/g, (_m, param: string) => {
    let name = param === "id" ? idVariableByResource[resource] : (variableByParam[param] ?? param);
    // Nunca se modifica el propio perfil por accidente: las escrituras usan `profileId`.
    if (writes && resource === "profiles" && name === "actorId") name = "profileId";
    if (!name || !(name in variables)) throw new Error(`Sin variable de Postman para :${param} en ${path}`);
    return `{{${name}}}`;
  });
}

const variablesIn = (url: string) => [...url.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);

// ── Colección de Postman v2.1 ──

const script = (listen: "prerequest" | "test", lines: string[]) => ({
  listen,
  script: { type: "text/javascript", exec: lines },
});

function request(method: string, url: string, body?: unknown, query = "") {
  return {
    method,
    header: body === undefined ? [] : [{ key: "Content-Type", value: "application/json" }],
    ...(body === undefined
      ? {}
      : { body: { mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } } }),
    url: {
      raw: `{{baseUrl}}${url}${query}`,
      host: ["{{baseUrl}}"],
      path: url.split("/").filter(Boolean),
      ...(query
        ? { query: query.slice(1).split("&").map((pair) => ({ key: pair.split("=")[0], value: pair.split("=")[1] })) }
        : {}),
    },
  };
}

/** Autenticación de cada petición: token de Supabase si hay `token`; si no, `X-Actor-Id` (solo desarrollo). */
const authScript = [
  "const token = pm.variables.get('token');",
  "if (token) {",
  "  pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + token });",
  "} else {",
  "  pm.request.headers.upsert({ key: 'X-Actor-Id', value: pm.variables.get('actorId') });",
  "}",
];

/**
 * Las escrituras sobre registros existentes (PATCH válido, DELETE, restaurar, asociar…)
 * solo corren sobre lo que la propia colección creó: si no, se omiten.
 * Así ejecutar la colección nunca modifica ni elimina los datos del seed.
 */
function guardScript(url: string): string[] {
  const vars = variablesIn(url);
  const created = vars.filter((v) => creatableVariables.has(v));
  const lines: string[] = [];
  if (created.length > 0) {
    lines.push(
      `const missing = ${JSON.stringify(created)}.filter((v) => !pm.collectionVariables.get('created_' + v));`,
      "if (missing.length) {",
      "  console.log('Omitida: la colección aún no creó ' + missing.join(', '));",
      "  pm.execution.skipRequest();",
      "}",
    );
  }
  if (vars.includes("profileId")) {
    lines.push(
      "if (!pm.variables.get('profileId')) {",
      "  console.log('Omitida: llena profileId con el perfil a modificar (nunca el propio)');",
      "  pm.execution.skipRequest();",
      "}",
    );
  }
  return lines;
}

const saveIdLines = (variable: string | undefined, status: number) =>
  variable
    ? [
        `if (code === ${status}) {`,
        `  pm.collectionVariables.set('${variable}', body.id);`,
        `  pm.collectionVariables.set('created_${variable}', 'true');`,
        "}",
      ]
    : [];

const invalidTests = (errorPaths: string[]) => [
  "pm.test('400 · error de validación', () => pm.response.to.have.status(400));",
  "const body = pm.response.json();",
  "pm.test('code = VALIDATION', () => pm.expect(body.error.code).to.eql('VALIDATION'));",
  `pm.test('Campos con error: ${errorPaths.join(", ")}', () => {`,
  "  const paths = (body.error.details || []).map((d) => d.path).sort();",
  `  pm.expect(paths).to.eql(${JSON.stringify([...errorPaths].sort())});`,
  "});",
];

/** Cuerpo válido o acción sin cuerpo: pasa la forma; puede chocar con una regla de negocio según los datos. */
const writeTests = (saveIdAs: string | undefined, saveStatus: number) => [
  "const code = pm.response.code;",
  "const body = code === 204 ? {} : pm.response.json();",
  "pm.test('Pasa la validación de forma (nivel 1)', () => {",
  "  pm.expect(code === 400 && body.error && body.error.details, 'error de esquema').to.not.be.ok;",
  "});",
  "pm.test('Sin error de autenticación ni interno', () => pm.expect(code).to.be.oneOf([200, 201, 204, 400, 404, 409]));",
  "pm.test('La ruta existe', () => pm.expect(code === 404 && /^La ruta/.test(body.error.message)).to.not.be.ok);",
  "// 404/409/400 sin details = regla de negocio (depende de los datos de la BD).",
  "if (code >= 400) console.log(code, body.error && body.error.message);",
  ...saveIdLines(saveIdAs, saveStatus),
];

/** Rutas que remiten al módulo administrativo: además de la forma, aceptan sus respuestas (401, 429, 5xx…). */
const externalGuard = (writes: boolean) =>
  writes
    ? [
        "if (pm.variables.get('runExternalWrites') !== 'true') {",
        "  console.log('Omitida: crea datos en el módulo administrativo; pon runExternalWrites = true para ejecutarla');",
        "  pm.execution.skipRequest();",
        "}",
      ]
    : [];

const externalTests = (saveTokenAs?: string) => [
  "const code = pm.response.code;",
  "const body = pm.response.json();",
  "pm.test('Respuesta remitida del módulo administrativo', () => pm.expect(code).to.be.oneOf([200, 201, 400, 401, 403, 409, 429, 502, 503, 504]));",
  "if (code >= 400) console.log(code, body.error && body.error.code, body.error && body.error.message);",
  ...(saveTokenAs ? [`if (code === 200 && body.token) pm.collectionVariables.set('${saveTokenAs}', body.token);`] : []),
];

/** GET /auth/profile: usa el token del login; sin él se omite. */
const profileAuthScript = [
  "const authToken = pm.variables.get('authToken');",
  "if (!authToken) {",
  "  console.log('Omitida: ejecuta antes Iniciar sesión con credenciales reales (llena authToken)');",
  "  pm.execution.skipRequest();",
  "} else {",
  "  pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + authToken });",
  "}",
];

const queryTests = [
  "const code = pm.response.code;",
  "pm.test('Responde 200 (o 404 si el id no existe en esta BD)', () => pm.expect(code).to.be.oneOf([200, 404]));",
  "if (code === 404) {",
  "  pm.test('La ruta existe', () => pm.expect(pm.response.json().error.message).to.not.match(/^La ruta/));",
  "}",
];

/** Consultas de ejemplo para las rutas que la exigen. */
const exampleQuery: Record<string, string> = {
  "/evaluation-scales/classify": "?value={{classifyValue}}",
};

/**
 * Orden dentro de cada carpeta: crear (válido, luego inválidos) → consultar →
 * actualizar → asociar/acciones → eliminar (primero lo más anidado) → restaurar.
 */
function stageOf(route: RouteDoc): number {
  const isCreate = route.method === "POST" && opByRoute.has(key(route.method, route.path));
  if (isCreate) return 0;
  if (route.method === "GET") return 1;
  if (route.method === "PATCH") return 2;
  if (route.method === "PUT" || (route.method === "POST" && !route.path.endsWith("/restore"))) return 3;
  if (route.method === "DELETE") return 4;
  return 5;
}
const depth = (path: string) => path.split("/").length;

interface Item {
  name: string;
  event: ReturnType<typeof script>[];
  request: ReturnType<typeof request>;
}

function itemsFor(route: RouteDoc): Item[] {
  const op = opByRoute.get(key(route.method, route.path));
  const title = `${route.method} ${route.path}`;

  if (op) {
    // Con cuerpo: un caso válido y sus inválidos.
    const writesExisting = route.method === "PATCH";
    const validUrl = postmanPath(route.path, writesExisting);
    const invalidUrl = postmanPath(route.path);
    const validEvents = op.external
      ? [script("prerequest", externalGuard(op.external.writes)), script("test", externalTests(op.external.saveTokenAs))]
      : [script("prerequest", guardScript(validUrl)), script("test", writeTests(op.http.saveIdAs, 201))];
    return [
      {
        name: `${op.title} · válido`,
        event: validEvents,
        request: request(route.method, validUrl, op.valid),
      },
      ...op.invalid.map((c) => ({
        name: `${op.title} · ${c.name}`,
        event: [script("test", invalidTests(c.errorPaths))],
        request: request(route.method, invalidUrl, c.body),
      })),
    ];
  }
  if (route.path === "/auth/profile") {
    return [
      {
        name: `${route.description} · ${title}`,
        event: [script("prerequest", profileAuthScript), script("test", externalTests())],
        request: request("GET", route.path),
      },
    ];
  }
  if (route.method === "GET") {
    return [
      {
        name: `${route.description} · ${title}`,
        event: [script("test", queryTests)],
        request: request("GET", postmanPath(route.path), undefined, exampleQuery[route.path] ?? ""),
      },
    ];
  }
  // Acción sin cuerpo sobre un registro existente.
  const url = postmanPath(route.path, true);
  return [
    {
      name: `${route.description} · ${title}`,
      event: [script("prerequest", guardScript(url)), script("test", writeTests(actionSaves[key(route.method, route.path)], 200))],
      request: request(route.method, url),
    },
  ];
}

const folders = entities.map((entity) => {
  const entityRoutes = routes
    .filter((r) => entityOf(r.path) === entity.name)
    .map((r, index) => ({ r, index }))
    .sort(
      (a, b) =>
        stageOf(a.r) - stageOf(b.r) ||
        (stageOf(a.r) === 4 ? depth(b.r.path) - depth(a.r.path) : 0) ||
        a.index - b.index,
    )
    .map(({ r }) => r);
  return { name: entity.name, item: entityRoutes.flatMap(itemsFor) };
});
const requestCount = folders.reduce((n, f) => n + f.item.length, 0);

const collection = {
  info: {
    name: "Seguimiento de estudiantes · API",
    description: [
      "Generada con `npm run docs:requests` desde scripts/request-catalog.ts. No editar a mano.",
      "",
      "Una carpeta por entidad, con todas sus rutas: crear (válido e inválidos) → consultar → actualizar → acciones → eliminar → restaurar.",
      "",
      "Antes de ejecutar: llena `actorId` (UUID de un perfil activo) o `token` (access_token de Supabase).",
      "Con `token` se envía `Authorization: Bearer`; sin él, `X-Actor-Id` (solo funciona fuera de producción).",
      "",
      "Las escrituras sobre registros existentes solo corren sobre lo que la colección creó en esta sesión (si no, se omiten),",
      "así que el seed no se modifica. Los perfiles solo se modifican si llenas `profileId`.",
      "Aun así, los casos válidos de crear escriben en la BD de `baseUrl`: úsala solo con la BD de pruebas.",
    ].join("\n"),
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  event: [script("prerequest", authScript)],
  variable: Object.entries(variables).map(([k, value]) => ({ key: k, value })),
  item: folders,
};

// ── Markdown ──

/** JSON legible; los textos muy largos (casos de longitud máxima) se resumen. */
const show = (body: unknown) =>
  JSON.stringify(body, (_k, v) => (typeof v === "string" && v.length > 60 ? `${v.slice(0, 3)}… (${v.length} caracteres)` : v), 2);
const inline = (body: unknown) => show(body).replace(/\s*\n\s*/g, " ");
const cell = (text: string) => text.replace(/\|/g, "\\|");

const md: string[] = [];
md.push(`# API: rutas y cuerpos de petición

> **Generado** con \`npm run docs:requests\` desde \`scripts/request-catalog.ts\`. No editar a mano: cambia el catálogo y regenera.
> Cada ejemplo se validó contra los esquemas Zod reales (nivel 1, [ADR-001](../decisiones/ADR-001-zod-esquemas-de-entrada.md)) y cada ruta contra las registradas en Express ([ADR-002](../decisiones/ADR-002-capa-http-express.md)).
> Reglas completas por tabla: [VALIDACIONES.md](../VALIDACIONES.md). Colección de Postman: [postman-coleccion.json](postman-coleccion.json) (ver [Uso en Postman](#uso-en-postman)).

## Convenciones generales

| Tema | Regla |
|---|---|
| Base | \`http://localhost:3000${API_PREFIX}\` (\`npm run dev\`; puerto con \`PORT\`) |
| Autenticación | \`Authorization: Bearer <access_token de Supabase>\`. Solo fuera de producción: \`X-Actor-Id: <uuid de un perfil>\`. El perfil debe existir y estar \`activo\`. Públicas: \`/health\` y \`/auth/register\`, \`/auth/login\`, \`/auth/profile\` (remiten al módulo administrativo, [ADR-003](../decisiones/ADR-003-autenticacion-modulo-administrativo.md)) |
| Formato | Cuerpo JSON (\`Content-Type: application/json\`) |
| Ids | En la entrada, número o texto con un entero positivo (\`12\` o \`"12"\`). En las respuestas, **texto** (\`"12"\`) |
| Fechas | Texto ISO 8601 con zona: \`"2026-10-20T15:00:00Z"\`. Las fechas de negocio se interpretan en hora de Bogotá |
| Textos | Se quitan espacios al inicio y al final, y los espacios dobles en nombres y títulos. Un texto opcional vacío se guarda como \`null\` |
| Campos opcionales | Se pueden omitir. Los marcados \`… \\| null\` aceptan \`null\` para borrar el valor |
| Campos desconocidos | **Se rechazan** (\`Campo no permitido\`), tanto en el cuerpo como en la consulta (\`?…\`) |
| Actualizar | \`PATCH\`: solo se cambian los campos enviados |
| Eliminar | \`DELETE\` hace borrado lógico y responde **204** sin cuerpo |
| Actor | No va en el cuerpo: es el usuario autenticado |

**Errores.** Formato único; \`details\` solo aparece en errores de forma (nivel 1) y trae todos los campos inválidos a la vez:

\`\`\`json
{
  "error": {
    "code": "VALIDATION",
    "message": "Taller: datos de entrada inválidos (name: Debe tener al menos 3 caracteres)",
    "details": [{ "path": "name", "message": "Debe tener al menos 3 caracteres" }]
  }
}
\`\`\`

| Situación | HTTP | \`code\` |
|---|---|---|
| Error de forma (esquema) o regla de negocio que invalida la entrada | 400 | \`VALIDATION\` |
| JSON mal formado | 400 | \`BAD_REQUEST\` |
| Sin autenticación, token inválido o perfil inexistente | 401 | \`UNAUTHORIZED\` |
| Perfil \`inactivo\` o \`bloqueado\` | 403 | \`FORBIDDEN\` |
| No existe (registro o ruta) | 404 | \`NOT_FOUND\` |
| Conflicto (duplicado, estado que no lo permite) | 409 | \`CONFLICT\` |
| Demasiados intentos (lo informa el módulo administrativo) | 429 | \`EXTERNAL_SERVICE\` |
| Error inesperado | 500 | \`INTERNAL\` |
| Servicio externo caído o con respuesta inesperada | 502 | \`EXTERNAL_SERVICE\` |
| Servicio externo sin configurar (\`RENDER_API_URL\`) | 503 | \`EXTERNAL_SERVICE\` |
| Servicio externo sin respuesta a tiempo | 504 | \`EXTERNAL_SERVICE\` |

## Rutas por entidad
`);

for (const entity of entities) {
  const entityRoutes = routes.filter((r) => entityOf(r.path) === entity.name);
  md.push(`### ${entity.name}

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
${entityRoutes
  .map((r) => {
    const op = opByRoute.get(key(r.method, r.path));
    const body = op ? `[\`${op.id}\`](#${op.id.replace(/\./g, "").toLowerCase()})` : "";
    return `| \`${r.method}\` | \`${r.path}\` | ${cell(r.description)} | ${r.query ?? ""} | ${body} |`;
  })
  .join("\n")}
`);
}

let currentFeature = "";
for (const op of operations) {
  if (op.feature !== currentFeature) {
    currentFeature = op.feature;
    md.push(`\n---\n\n## Cuerpos · feature \`${op.feature}\`\n`);
  }
  const paths = `\`${op.http.method} ${API_PREFIX}${op.http.path}\``;
  md.push(`### ${op.id}

**${op.title}** · ${paths} · \`${op.service}\`
${op.warning ? `\n> ⚠️ ${op.warning}\n` : ""}
| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
${op.fields.map((f) => `| \`${f.name}\` | ${cell(f.type)} | ${f.required ? "**Sí**" : "No"} | ${cell(f.rules)} |`).join("\n")}

**Cuerpo válido:**

\`\`\`json
${show(op.valid)}
\`\`\`

**Casos inválidos (400, \`VALIDATION\`):**

| Caso | Cuerpo | Campos con error (\`details[].path\`) |
|---|---|---|
${op.invalid.map((c) => `| ${c.name} | \`${cell(inline(c.body))}\` | ${c.errorPaths.map((p) => `\`${p}\``).join(", ")} |`).join("\n")}

**Reglas de negocio** (las valida el servicio, no el esquema):

${op.businessRules.map((r) => `- ${r}`).join("\n")}
`);
}

md.push(`
---

## Uso en Postman

**Archivo:** \`docs/api/postman-coleccion.json\` (Postman v2.1). Trae las ${routes.length} rutas en ${requestCount} peticiones, **una carpeta por entidad**: ${entities.map((e) => e.name).join(", ")}.

1. En Postman: *Import → File* y elige \`docs/api/postman-coleccion.json\`.
2. En la pestaña *Variables* de la colección llena:
   - \`actorId\`: UUID de un perfil activo (p. ej. el de \`DB_CHECK_ACTOR\`), **o**
   - \`token\`: \`access_token\` de una sesión de Supabase. Si hay \`token\`, se usa en lugar de \`actorId\`.
3. Arranca la API con \`npm run dev\`.
4. Ejecuta la colección completa (*Run collection*), una carpeta o cada petición.

**Orden dentro de cada carpeta:** crear (válido e inválidos) → consultar → actualizar → acciones (asociar, recalcular) → eliminar → restaurar.

**Pruebas de cada petición:**

| Petición | Espera |
|---|---|
| Consulta (GET) | 200, o 404 si el id no existe en esa BD |
| Cuerpo inválido | 400 con \`code = VALIDATION\` y exactamente los \`details[].path\` declarados |
| Cuerpo válido o acción | Pasa la forma; puede responder 2xx o un error de negocio (400 sin \`details\`, 404, 409) según los datos. Si crea, guarda el \`id\` en la variable de la entidad |

**Protección de datos:**

- Las escrituras sobre registros existentes (actualizar con cuerpo válido, asociar, eliminar, restaurar) **solo corren sobre lo que la colección creó** en esa sesión de Postman; si no, se omiten (\`pm.execution.skipRequest\`). El seed no se modifica.
- Los perfiles solo se modifican o eliminan si llenas \`profileId\` (nunca uses el propio: perderías el acceso).
- **Autenticación:** los casos inválidos se rechazan aquí (no llegan al módulo administrativo). \`Iniciar sesión · válido\` sí lo llama (cambia el cuerpo por credenciales reales); si responde 200, guarda el token en \`authToken\`, que usa \`GET /auth/profile\`. \`Registrar usuario · válido\` **crea un usuario real allá**: solo corre con \`runExternalWrites = true\`.
- Los casos válidos de **crear sí escriben** en la BD de \`baseUrl\`: úsala solo con la BD de pruebas. Al repetir la colección, varios responden 409 (ya existen): es esperado.

Las variables de ids traen valores de la BD de pruebas (\`npm run db:seed:dev\` y el simulado del módulo administrativo: estudiante \`1\`, acudiente \`10\`, tallerista \`500\`).

\`postman-casos.json\` tiene los casos de cuerpo como **archivo de datos** (*Data file* del Collection Runner), con \`method\` y \`path\` de cada uno.
`);

// ── Datos para Postman (archivo de datos del Runner) ──
const cases = operations.flatMap((op) => {
  const common = { operation: op.id, method: op.http.method, path: postmanPath(op.http.path) };
  return [
    { ...common, case: "Cuerpo válido", expect: "valid", body: JSON.stringify(op.valid), errorPaths: [] as string[] },
    ...op.invalid.map((c) => ({ ...common, case: c.name, expect: "invalid", body: JSON.stringify(c.body), errorPaths: c.errorPaths })),
  ];
});

// ── OpenAPI para Swagger UI ──

const isPublic = (path: string) => path === "/health" || path.startsWith("/auth/");
const errorRef = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
});
const errorDescriptions: Record<number, string> = {
  400: "Datos inválidos",
  401: "Sin autenticación válida",
  403: "Perfil inactivo o bloqueado",
  404: "No existe",
  409: "Conflicto con el estado actual",
  429: "Demasiados intentos",
  502: "El módulo administrativo falló",
  503: "Autenticación sin configurar",
  504: "El módulo administrativo no respondió a tiempo",
};
const errorCodes = (route: RouteDoc): number[] => {
  if (route.path === "/health") return [];
  if (isPublic(route.path)) return [400, 401, 403, 409, 429, 502, 503, 504];
  return route.method === "GET" ? [400, 401, 403, 404] : [400, 401, 403, 404, 409];
};
const successOf = (route: RouteDoc): { status: number; description: string } => {
  if (route.method === "DELETE") return { status: 204, description: "Eliminado (sin cuerpo)" };
  const creates = route.method === "POST" && opByRoute.has(key(route.method, route.path)) && route.path !== "/auth/login";
  return creates ? { status: 201, description: "Creado" } : { status: 200, description: "Correcto" };
};

/** Esquema del cuerpo: la forma sale de Zod; las reglas y el ejemplo, del catálogo. */
function bodySchema(op: Operation) {
  const schema = z.toJSONSchema(op.schema, { target: "openapi-3.0", io: "input", unrepresentable: "any" }) as {
    properties?: Record<string, Record<string, unknown>>;
  };
  for (const field of op.fields) {
    const property = schema.properties?.[field.name];
    if (property) property["description"] = `${field.type}. ${field.rules}`;
  }
  return schema;
}

const apiPaths: Record<string, Record<string, unknown>> = {};
for (const route of routes) {
  const op = opByRoute.get(key(route.method, route.path));
  const success = successOf(route);
  const pathParams = [...route.path.matchAll(/:(\w+)/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
  const queryParams = [...(route.query ?? "").matchAll(/`(\w+)`/g)].map((m) => ({
    name: m[1],
    in: "query",
    required: route.path in exampleQuery,
    schema: { type: "string" },
  }));
  const responses: Record<string, unknown> = { [success.status]: { description: success.description } };
  for (const code of errorCodes(route)) responses[code] = errorRef(errorDescriptions[code]!);

  const openApiPath = route.path.replace(/:(\w+)/g, "{$1}");
  apiPaths[openApiPath] ??= {};
  apiPaths[openApiPath][route.method.toLowerCase()] = {
    tags: [entityOf(route.path)],
    summary: route.description,
    ...(route.query ? { description: `Consulta: ${route.query}` } : {}),
    // Pública: sin autenticación. El perfil usa el token del login administrativo.
    security:
      route.path === "/auth/profile"
        ? [{ bearerAuth: [] }]
        : isPublic(route.path)
          ? []
          : [{ bearerAuth: [] }, { actorId: [] }],
    ...(pathParams.length + queryParams.length > 0 ? { parameters: [...pathParams, ...queryParams] } : {}),
    ...(op
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: bodySchema(op), example: op.valid } },
          },
        }
      : {}),
    responses,
  };
}

const apiDocs = {
  tags: entities.map((entity) => ({ name: entity.name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "JWT de Supabase o, en /auth/profile, el token del login" },
      actorId: { type: "apiKey", in: "header", name: "X-Actor-Id", description: "UUID de un perfil activo (solo fuera de producción)" },
    },
    schemas: {
      ApiError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: { path: { type: "string" }, message: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
  ...apiPaths,
};

mkdirSync("src/docs", { recursive: true });
// JSON también es YAML válido. Generado: no editar a mano.
writeFileSync("src/docs/api-routes.yaml", JSON.stringify(apiDocs, null, 2) + "\n", "utf8");
mkdirSync("docs/api", { recursive: true });
writeFileSync("docs/api/CUERPOS_DE_PETICION.md", md.join("\n"), "utf8");
writeFileSync("docs/api/postman-coleccion.json", JSON.stringify(collection, null, 2) + "\n", "utf8");
writeFileSync("docs/api/postman-casos.json", JSON.stringify(cases, null, 2) + "\n", "utf8");
console.log(`✔ ${operations.length} operaciones y ${cases.length} casos validados contra los esquemas Zod.`);
console.log(`✔ ${routes.length} rutas verificadas contra Express.`);
console.log("  → docs/api/CUERPOS_DE_PETICION.md");
console.log(`  → docs/api/postman-coleccion.json (${folders.length} carpetas, ${requestCount} peticiones)`);
for (const f of folders) console.log(`      · ${f.name}: ${f.item.length}`);
console.log("  → docs/api/postman-casos.json");
console.log("  → src/docs/api-routes.yaml (Swagger UI)");
