# Módulo de Seguimiento y Desarrollo de Estudiantes

## 1. Contexto

- Este repositorio corresponde al **módulo de servicio** de un proyecto general. Su dominio es el **seguimiento y desarrollo de estudiantes** a través de talleres, habilidades y evidencias.
- El módulo usa una **base de datos general** en **Supabase (PostgreSQL)**, compartida con otros módulos. Cada módulo maneja su propio esquema de Postgres. Se consume con el ORM **Prisma**.
- La **información personal** de jóvenes, acudientes y talleristas la administra el **módulo administrativo**. Este módulo solo la **lee** (sección 3.3).
- Se prioriza la **inversión de dependencias** y se usa una **arquitectura por features**.

### Actores

| Actor | Origen | Nota |
|---|---|---|
| Estudiante (joven) | `administrativo.children` | Solo lectura |
| Acudiente | `administrativo.guardians` + `children_guardians` | Solo lectura |
| Tallerista | `administrativo.professionals` | Solo lectura. Sus datos personales están en `staff`, que no se integra |
| Administrativo | `public.administrators` | **Provisional**. Puede consultar información y subir evidencias |

- **No se usa `profile_id`** para enlazar actores con cuentas; fue una decisión de diseño. `perfiles` (1 a 1 con `auth.users`) solo sirve para el login y para identificar al `actor` que queda en la auditoría.

### Acuerdos de trabajo

- **No instalar dependencias sin consultarlo antes.** Revisar `package.json` y `package-lock.json` para saber qué hay instalado.
- **La fuente de verdad de nuestras tablas es [`database/asisco_login_supabase.sql`](../database/asisco_login_supabase.sql).** `prisma/schema.prisma` la refleja.
- **No se borra físicamente:** se usa borrado lógico con auditoría (sección 3.2).
- **Código en inglés, comentarios en español.**

### Estado actual (2026-10-26)

- **La BD general aún no está montada en Supabase.**
- El modelo se rehízo según el diagrama del módulo. Se probó en un Postgres local (PGlite) con `auth` y el esquema `administrativo` simulados: 200 casos de punta a punta con todos los servicios.
- Falta probarlo en Supabase real (RLS con usuarios reales, pooler, permisos sobre el esquema administrativo).

---

## 2. Stack

| Pieza | Paquete | Versión |
|---|---|---|
| Lenguaje | `typescript` | 7.x (ESM, `module: nodenext`) |
| Ejecución en desarrollo | `tsx` | 4.x |
| ORM | `prisma` / `@prisma/client` | 7.10 (generador `prisma-client`, varios esquemas) |
| Driver | `@prisma/adapter-pg` (incluye `pg`) | 7.10 |
| Variables de entorno | `dotenv` | 18.x |
| Validación de entrada (nivel 1) | `zod` | 4.6.x — ver [ADR-001](decisiones/ADR-001-zod-esquemas-de-entrada.md) |
| HTTP | `express` + `cors` | 5.x / 2.x — ver [ADR-002](decisiones/ADR-002-capa-http-express.md) |
| Verificación de JWT de Supabase | `jose` | 6.x — ver [ADR-002](decisiones/ADR-002-capa-http-express.md) |

- El cliente de Prisma se genera en `generated/prisma/`, que está ignorado por git. Se regenera con `npm run prisma:generate`.
- La configuración de la CLI está en `prisma7.config.ts`. Como no usa el nombre por defecto, todos los comandos de Prisma llevan `--config prisma7.config.ts`.

### Scripts

| Script | Uso |
|---|---|
| `npm run dev` | Arranca la API con recarga (`tsx watch src/server.ts`) |
| `npm start` | Arranca la API (`tsx src/server.ts`) |
| `npm run typecheck` | Verifica los tipos (`tsc --noEmit`) |
| `npm run prisma:generate` | Genera el cliente Prisma |
| `npm run prisma:validate` | Valida `prisma/schema.prisma` |
| `npm run prisma:studio` | Abre Prisma Studio (requiere BD) |
| `npm run db:check` | Verifica la conexión y el estado de la BD configurada en `.env` (solo lectura) |
| `npm run db:seed:dev` | Carga datos de prueba en la **BD de pruebas** usando los servicios del módulo (solo corre si existe el simulado del administrativo) |
| `npm run docs:requests` | Regenera [api/CUERPOS_DE_PETICION.md](api/CUERPOS_DE_PETICION.md) (rutas y cuerpos), la colección `api/postman-coleccion.json` y `api/postman-casos.json` desde `scripts/request-catalog.ts`. Valida cada ejemplo contra los esquemas Zod y cada ruta contra Express |

### Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Runtime de la app. En Supabase: **Transaction pooler** (puerto 6543) |
| `DIRECT_URL` | CLI de Prisma (`db pull`). En Supabase: **Session pooler** (puerto 5432); la conexión "Direct" de Supabase solo funciona por IPv6. Si falta, se usa `DATABASE_URL` |
| `DB_CHECK_ACTOR` | Opcional: UUID de un usuario de Supabase Auth que `db:check` verifica (el `actor` de las pruebas) |
| `PORT` | Puerto de la API (por defecto 3000) |
| `NODE_ENV` | `production` desactiva la cabecera `X-Actor-Id`. **Obligatorio al desplegar** |
| `SUPABASE_URL` | `https://<ref>.supabase.co`: emisor del JWT y su JWKS. Sin ella solo funciona `X-Actor-Id` |
| `SUPABASE_JWT_SECRET` | Opcional: secreto HS256 si el proyecto usa las claves JWT antiguas |
| `CORS_ORIGIN` | Opcional: orígenes permitidos separados por comas (sin ella, cualquiera) |

### 2.1 BD de pruebas del módulo

El módulo tiene su **propio proyecto de Supabase para pruebas**. El código lee la conexión solo desde `.env`, así que pasar a la BD general es **cambiar `DATABASE_URL` y `DIRECT_URL`**.

**Preparar la BD de pruebas** (SQL Editor de Supabase, en este orden):

1. `database/asisco_login_supabase.sql`: nuestras tablas. Es el mismo script que se ejecutará en la BD general.
2. `database/dev/administrativo_simulado.sql`: simula `administrativo.children`, `guardians`, `children_guardians` y `professionals` con datos de ejemplo. **Solo en la BD de pruebas; nunca en la general**, donde esas tablas son del equipo administrativo. Se puede ejecutar varias veces sin duplicar.
3. En Authentication → Add user, crear un usuario. El trigger `crear_perfil` crea su perfil; su UUID es el `actor` (opcional en `DB_CHECK_ACTOR`).
4. Completar la contraseña en `.env` y ejecutar `npm run db:check`.
5. Opcional: `npm run db:seed:dev` para cargar datos de prueba de consumo.

**Datos de prueba (`npm run db:seed:dev`, `scripts/db-seed-dev.ts`):**

- **Usa los servicios del módulo,** no SQL directo. Cada registro pasa por las validaciones y reglas reales, queda auditado con `DB_CHECK_ACTOR` y las calificaciones se calculan solas.
- **Qué carga:**
  - 3 categorías y 8 habilidades.
  - 4 escalas que cubren 0–5 sin huecos (`BAJO` 1, `BASICO` 2.5, `ALTO` 3.5, `SUPERIOR` 4.5).
  - 2 administrativos.
  - 3 talleres: "Música y ritmo" (finalizado), "Teatro y expresión" y "Pintura creativa" (activos). En total, unas 31 asistencias con 90 evaluaciones.
  - 3 evidencias.
  - 2 credenciales (una validada).
- **Determinista e idempotente:** produce siempre los mismos datos y, si se repite, no duplica nada.
- **Protección:** antes de escribir verifica que existan los datos simulados del módulo administrativo (joven 1 "Leo Paz", TI-1001; tallerista 500). En la BD general se niega a correr.

**Al pasar a la BD general:**

- Se reemplazan las dos URLs y **no** se ejecuta el SQL simulado.
- Lo único que podría cambiar fuera de `.env` es el nombre real del esquema administrativo (hoy `administrativo`, provisional), que se ajusta en `schema.prisma`.
- Tampoco en pruebas se usan `prisma migrate dev` ni `db push`: las tablas se crean siempre con el SQL.

---

## 3. Modelo de datos

```
                       administrativo (solo lectura)
   children ──< children_guardians >── guardians        professionals
      │  (student_id, sin FK)                                │ (evaluator_id, sin FK)
      ▼                                                      ▼
 workshop_attendances >──────────────────────────────── workshops ──< workshop_skills >── skills >── skill_categories
      │                                                      │               │              │
      └──< evaluation_skills >── evaluation_scales           │               │              └──< student_skills (student_id)
               └───────────────── workshop_skills ───────────┘               │
                                                                             │
 evidences ──< student_evidences (student_id)        credentials (student_id, workshop_id opcional)
```

### 3.1 Nuestras tablas (esquema `public`)

**Acceso.** Vienen del script de login y conservan los nombres en español.

| Tabla | Modelo | Clave | Notas |
|---|---|---|---|
| `aplicaciones` | `App` | `codigo` | Catálogo de aplicaciones del ecosistema |
| `roles` | `Role` | `codigo` | Catálogo (`administrador`, `tallerista`, …) |
| `perfiles` | `Profile` | `id` (= `auth.users.id`) | Lo crea el trigger `crear_perfil` al registrarse |
| `usuario_roles` | `UserRole` | `id` | `aplicacion = null` significa rol global. `unique nulls not distinct` (`usuario_id`, `rol`, `aplicacion`) |

**Administrativos (provisional).**

| Tabla | Modelo | Notas |
|---|---|---|
| `administrators` | `Administrator` | Obligatorios: `full_name`, `document_type` (catálogo), `document_number` (único), `email` (único, en minúsculas) y `position`. Opcional: `phone`. `status` (`active` \| `inactive`). Validaciones: [VALIDACIONES.md §3.1](VALIDACIONES.md) |

**Habilidades.**

| Tabla | Modelo | Notas |
|---|---|---|
| `skill_categories` | `SkillCategory` | `name` (2–100, sin espacios sobrantes, **único sin distinguir mayúsculas**: índice sobre `lower(name)`), `description` opcional (máx. 500). Validaciones: [VALIDACIONES.md §3.2](VALIDACIONES.md) |
| `skills` | `Skill` | `name` (2–100, **único por categoría** sin distinguir mayúsculas), categoría, `status` (`active` \| `inactive`). Con historial no se elimina: se inactiva. Validaciones: [VALIDACIONES.md §3.3](VALIDACIONES.md) |
| `student_skills` | `StudentSkill` | Calificación de una habilidad en un estudiante, como **referencia a una escala** (`evaluation_scale_id`, relación `RATTED_ON`). **Se calcula** a partir de las evaluaciones (sección 3.4); no se asigna a mano. Único (`student_id`, `skill_id`) |
| `evaluation_scales` | `EvaluationScale` | Escala de calificación: `code` (solo mayúsculas, números y `_`: `^[A-Z0-9_]{1,30}$`, único), `name` (único sin distinguir mayúsculas), `num_value` (valor de la calificación; da el orden y es lo que se promedia), `min_value`–`max_value` (intervalo inclusivo de promedios que caen en la escala). Todo en el **rango 0–5** y `min ≤ num ≤ max`. Entre escalas vigentes, los intervalos no se solapan (restricción de exclusión en la BD) y se permiten huecos. Si está en uso, sus valores no cambian. Validaciones: [VALIDACIONES.md §3.4](VALIDACIONES.md) |
| `evaluation_skills` | `EvaluationSkill` | Escala asignada a una habilidad del taller en una asistencia. Única (`workshop_attendance_id`, `workshop_skill_id`). Solo se evalúa en talleres `active`; con el taller cerrado no se cambia ni se elimina. Validaciones: [VALIDACIONES.md §3.9](VALIDACIONES.md) |

**Talleres.**

| Tabla | Modelo | Notas |
|---|---|---|
| `workshops` | `Workshop` | `evaluator_id` → tallerista, `name` (3–150), `starts_at`/`ends_at` (fin ≥ inicio), `status` con ciclo de vida (siempre nace `planned`) `planned → active → finished` y `planned`/`active` → `cancelled`. `active` exige inicio y `finished` exige fin. Solo `planned` se edita; con asistencias no se elimina, se cancela. Validaciones: [VALIDACIONES.md §3.6](VALIDACIONES.md) |
| `workshop_skills` | `WorkshopSkill` | Habilidades del taller. Único (`workshop_id`, `skill_id`). Solo se cambian con el taller `planned`; con evaluaciones vigentes no se quitan; activar un taller exige al menos una. Validaciones: [VALIDACIONES.md §3.7](VALIDACIONES.md) |
| `workshop_attendances` | `WorkshopAttendance` | Asistencia de un estudiante activo a un taller `active`: `attended_at` (no futura, dentro de las fechas del taller) y `observation` (máx. 1000). Una por estudiante, taller y día (hora de Bogotá). Con el taller cerrado solo se corrige la observación. Validaciones: [VALIDACIONES.md §3.8](VALIDACIONES.md) |

**Evidencias.**

| Tabla | Modelo | Notas |
|---|---|---|
| `evidences` | `Evidence` | `url` (https, máx. 2048) y `title` (obligatorio, 2–150). Se relaciona con 1 a 50 estudiantes activos. Quién la subió y cuándo quedan en `creado_por`/`creado_en` (diagrama: `upload_by`/`upload_at`). Validaciones: [VALIDACIONES.md §3.10](VALIDACIONES.md) |
| `student_evidences` | `StudentEvidence` | Estudiantes de una evidencia. Único (`student_id`, `evidence_id`) |
| `credentials` | `Credential` | Credencial o certificado del estudiante: `organization_name` (obligatorio, 2–150), `url` (https, obligatoria), taller opcional (`finished` y con asistencia del estudiante), `status` (`pending` → `valid` → `revoked`; nace `pending`). Solo `pending` se edita o elimina. Validaciones: [VALIDACIONES.md §3.12](VALIDACIONES.md) |

Los valores de `status` de todas las tablas del módulo están aprobados (ver [VALIDACIONES.md](VALIDACIONES.md)).

**Ajustes respecto al diagrama del módulo:**

- **Renombres:**
  - `user_id` → `student_id` en `StudentSkills` y `StudentEvidence`. En `WorkshopAttendance` el diagrama ya usa `student_id`.
- **`evaluation_scales`:** `sort_order` se reemplazó por `num_value` y se agregaron `min_value`/`max_value`.
  - `workshop_skill` → `workshop_skill_id`.
  - `update_by` → `updated_by`.
- **`Guardian.student_id` no se usa:** el vínculo ya está en `children_guardians`.
- **Auditoría unificada:** todas las tablas tienen las mismas 6 columnas. Por eso `upload_by`/`upload_at` de `Evidence` pasan a ser `creado_por`/`creado_en`.
- **`profile_id` de `Student`, `Guardian` y `Teacher` no se usa** (decisión de diseño).

**Convenciones:**

- **En el código:** modelos y campos en inglés (`Workshop.startsAt` → `workshops.starts_at`). Los checks de la BD se reflejan como tipos unión (`WorkshopStatus`, `SkillStatus`, `CredentialStatus`, …) con los mismos valores.
- **Referencias al módulo administrativo** (`student_id`, `evaluator_id`): son `bigint` **sin FK física** ni relación en Prisma. Los servicios validan su existencia con los `*Reader`. Así no bloqueamos sus operaciones ni dependemos del orden de creación de sus tablas.

### 3.2 Auditoría y borrado lógico

**Todas nuestras tablas** tienen estas columnas. Las agrega `public.habilitar_auditoria(tabla, ...pk)`:

| Columna | Quién la escribe |
|---|---|
| `creado_en`, `actualizado_en`, `eliminado_en` | Siempre la BD (`now()`) |
| `creado_por`, `actualizado_por`, `eliminado_por` | `auth.uid()` si la petición trae JWT (Supabase/PostgREST). Si no, el valor que envía el backend |

- **Trigger `auditar()`** (BEFORE INSERT/UPDATE): pone las fechas, hace inmutables `creado_*` y registra `eliminado_*` al marcar `eliminado_en`. Al restaurar, los limpia.
- **Trigger `borrado_logico()`** (BEFORE DELETE): convierte todo `DELETE` en `eliminado_en = now()`.
- **Sin cascadas:** todas las FK son `on delete restrict`.
- **Restaurar en vez de duplicar:** si se vuelve a crear una relación que tiene unique (habilidad de un taller, evaluación, estudiante de una evidencia, nivel de una habilidad), se restaura la misma fila.
- **RLS:** `tiene_rol()` y las políticas ignoran los registros eliminados. La administración (rol `administrador`) gestiona todas las tablas del módulo desde Supabase, y los catálogos (habilidades, categorías, escalas) son legibles para cualquier usuario autenticado.
- **Purga real** (excepcional):
  ```sql
  begin;
  set local asisco.permitir_borrado_fisico = 'on';
  delete from ...;   -- primero los hijos: las FKs son restrict
  commit;
  ```

**En el código:**

- **Base del dominio:** `AuditableEntity` ([src/shared/domain/auditable.ts](../src/shared/domain/auditable.ts)), con `createdAt/By`, `updatedAt/By` y `deletedAt/By`.
- **Auditoría en Prisma:** `audit.create | update | delete | restore(actor)` en [src/shared/infrastructure/prisma/audit.ts](../src/shared/infrastructure/prisma/audit.ts).
  - Prisma se conecta sin JWT, así que **el actor se envía siempre**: todo método que escribe recibe `actor: ActorId`, el id del perfil que ejecuta la operación.
- **Consultas:** filtran `notDeleted` por defecto. `{ includeDeleted: true }` permite ver los eliminados.

### 3.3 Consumo del módulo administrativo (solo lectura)

| Tabla (esquema `administrativo`*) | Modelo / entidad | Clave | Uso |
|---|---|---|---|
| `children` | `Child` | `child_id` (bigint) | Datos personales del estudiante. `sex`, `document_type` y `status_id` son códigos de catálogos del módulo administrativo |
| `guardians` | `Guardian` | `guardian_id` (bigint) | Datos del acudiente |
| `children_guardians` | `ChildGuardian` | `child_guardian_id` (bigint) | Vínculo estudiante–acudiente. `end_date = null` significa vigente |
| `professionals` | `Professional` | `professional_id` (bigint) | Tallerista: títulos, instituciones, `time_donor`. Solo `staff_id` de `staff` |

\* Nombre de esquema provisional.

- **Solo lectura:** se mapean con `@@schema("administrativo")` y sus nombres tal cual, sin auditoría, sin escritura y fuera de nuestro SQL.
- **Puertos `*Reader`:** `ChildReader`, `GuardianReader` y `ProfessionalReader`, solo con métodos `find*`. Los usan `AdministrativeService` y los servicios que validan estudiantes o talleristas.
- **Nulabilidad asumida:** su diagrama no la indica, así que, salvo las llaves, todo se asume opcional.

### 3.4 Calificaciones

**Calificación de una habilidad en un estudiante** (`student_skills`):

1. Cada vez que se evalúa una habilidad en un taller (`evaluation_skills`), la calificación del estudiante en esa habilidad se actualiza así:
   - **Primera evaluación:** la calificación es la escala con que se evaluó.
   - **Siguientes:** `(num_value de la calificación anterior + num_value de la nueva evaluación) / 2`, **redondeado a 2 decimales**. El resultado se clasifica en la escala activa cuyo intervalo `[min_value, max_value]` lo contiene. Sin el redondeo, `(1 + 2.99) / 2 = 1.995` caería entre 1.99 y 2.00.
2. La calificación se **recalcula desde el historial**: todas las evaluaciones vigentes del estudiante en esa habilidad, en orden de fecha de asistencia. Solo cuentan las evaluaciones cuya asistencia y habilidad de taller siguen vigentes. Si no quedan evaluaciones, la calificación se elimina (borrado lógico).
3. Se recalcula automáticamente cuando:
   - se evalúa, se reevalúa o se elimina una evaluación;
   - se **elimina una asistencia**: se recalculan las habilidades evaluadas en ella;
   - se **quita una habilidad de un taller**: se recalculan los estudiantes evaluados en ella. Solo se permite si sus evaluaciones vigentes ya no existen (§3.7), así que en la práctica cubre evaluaciones de asistencias eliminadas;
   - se **vuelve a asociar** esa habilidad al taller: sus evaluaciones vuelven a contar.

   El recálculo vive en `GradingService`, detrás del puerto `SkillGradeRecalculator` ([src/evaluations/domain/skill-grade-recalculator.ts](../src/evaluations/domain/skill-grade-recalculator.ts)). Talleres y asistencias dependen solo de esa interfaz.

Ejemplo, con las escalas Bajo (1) [0–1.99], En proceso (3) [2–3.49] y Logrado (4.5) [3.5–5]:

| Evaluación | Cálculo | Calificación |
|---|---|---|
| Logrado (4.5) | — | Logrado |
| Bajo (1) | (4.5 + 1) / 2 = 2.75 | En proceso |
| Logrado (4.5) | (3 + 4.5) / 2 = 3.75 | Logrado |

Como `student_skills` guarda la **escala** y no el número, cada paso parte del `num_value` de la escala anterior (3 en el ejemplo, no 2.75). Así lo define el modelo actual.

**Promedio por categoría** (`SkillsService.getCategoryAverages`): suma de los `num_value` de las calificaciones del estudiante en las habilidades de la categoría, dividida entre la cantidad de habilidades calificadas. Se redondea a 2 decimales y se indica la escala en la que cae. Por ejemplo, 3.75 en "Socioemocional" cae en Logrado.

Las reglas están en funciones puras del dominio ([src/evaluations/domain/grading.ts](../src/evaluations/domain/grading.ts)): `accumulateSkillGrade`, `findScaleForValue` y `average`.

---

## 4. Arquitectura por features

### Estructura

```
src/
├── container.ts                 # Raíz de composición (único punto que une Prisma con los servicios)
├── server.ts                    # Arranque del servidor HTTP
├── shared/
│   ├── application/
│   │   ├── validation.ts        # parseInput(): esquema Zod → ValidationError con details
│   │   └── schemas.ts           # Esquemas Zod reutilizables (id, uuid, nombre, persona, texto, email, teléfono, URL, fecha, documento)
│   ├── domain/
│   │   ├── auditable.ts         # AuditableEntity (base), ActorId, QueryOptions
│   │   ├── document-types.ts    # Catálogo de tipos de documento
│   │   ├── dates.ts             # "Hoy" en America/Bogota y fechas de columnas date
│   │   └── errors.ts            # DomainError, NotFoundError, ConflictError, ValidationError
│   ├── http/
│   │   ├── app.ts               # createApp(container): middlewares, routers bajo /api/v1, errores
│   │   ├── authenticate.ts      # actor: JWT de Supabase (jose) o X-Actor-Id solo en desarrollo
│   │   ├── error-handler.ts     # Errores de dominio → HTTP; formato { error: { code, message, details? } }
│   │   ├── http-errors.ts       # UnauthorizedError (401), ForbiddenError (403)
│   │   └── request.ts           # readParams/readQuery (Zod), actorOf(res), esquemas de parámetros
│   └── infrastructure/prisma/
│       ├── prisma.client.ts     # createPrismaClient() + re-export de Prisma/PrismaClient
│       ├── audit.ts             # audit.*(actor), auditSelect, notDeleted
│       ├── mappers.ts           # decimalToNumber()
│       └── prisma-errors.ts     # withPrismaErrors(): errores de Prisma → errores de dominio
├── administrative/   # Lectura: children, guardians, children_guardians, professionals
├── profiles/         # perfiles (cuentas)
├── access/           # aplicaciones, roles, usuario_roles
├── administrators/   # administrators (provisional)
├── skills/           # skill_categories, skills, student_skills
├── evaluations/      # evaluation_scales, evaluation_skills
├── workshops/        # workshops, workshop_skills, workshop_attendances
└── evidences/        # evidences, student_evidences, credentials
```

Cada feature tiene la misma forma:

```
<feature>/
├── domain/
│   ├── <entity>.entity.ts         # Tipos de dominio y DTOs de entrada
│   └── <entity>.repository.ts     # Interfaces de repositorio (puertos); *.readers.ts si es solo lectura
├── application/
│   ├── <feature>.service.ts       # Casos de uso y reglas de negocio
│   └── <entity>.schemas.ts        # Esquemas Zod de entrada (nivel 1, ADR-001)
├── infrastructure/
│   └── prisma-<entity>.repository.ts   # Adaptadores Prisma
├── http/
│   └── <feature>.routes.ts        # Router Express: solo servicios, sin reglas de negocio (ADR-002)
└── index.ts                       # API pública: dominio + aplicación (sin infraestructura)
```

### Reglas de dependencia

```
infrastructure ──▶ domain ◀── application
        ▲                          ▲
        └──────── container.ts ────┘
```

1. **`domain`** no importa nada externo: ni Prisma ni otras capas.
2. **`application`** solo depende de **interfaces** de `domain`, sean de su propia feature o de otras (por ejemplo, `EvaluationsService` usa `WorkshopAttendanceRepository` y `AttendanceService` usa `ChildReader`).
3. **`infrastructure`** implementa esas interfaces y es la única capa que conoce Prisma. Importa Prisma siempre desde `shared/infrastructure/prisma/prisma.client.ts`.
4. **`container.ts`** es el único archivo que instancia las implementaciones concretas y las inyecta en los servicios.
5. **Los repositorios devuelven entidades de dominio**: usan `select` explícito y mapeo `toX()`, y nunca exponen tipos de Prisma.
6. **Errores del ORM:** se traducen con `withPrismaErrors`.
   - `P2002` → `ConflictError`
   - `P2003` → `ValidationError`
   - `P2025` → `NotFoundError`

### Servicios disponibles (`createContainer()`)

Todos los métodos que escriben reciben `actor`. Eliminar es siempre borrado lógico.

| Clave | Servicio | Casos de uso principales |
|---|---|---|
| `administrative` | `AdministrativeService` | Lectura de estudiantes, acudientes (con vínculos vigentes) y talleristas |
| `administrators` | `AdministratorsService` | `get`, `list`, `create` y `update` (documento y email únicos; email normalizado), `delete`, `restore` |
| `profiles` | `ProfilesService` | `get`, `list`, `update`, `delete`, `restore` |
| `access` | `AccessService` | Catálogos de aplicaciones y roles; `assignRole`, `revokeRole`, `getUserRoles`, `hasRole` |
| `skills` | `SkillsService` | Categorías y habilidades (CRUD; nombres únicos sin distinguir mayúsculas, el de la habilidad por categoría; no se elimina una categoría con habilidades ni una habilidad con historial); `listStudentSkills` (calificaciones calculadas), `getCategoryAverages` (promedio por categoría) |
| `evaluations` | `EvaluationsService` | Escalas: CRUD con las reglas de §3.4 (rango 0–5, sin solapamiento, valores fijos si está en uso), ordenadas por `num_value`. `classify(valor)` (redondea a 2 decimales), `getCoverageGaps()`. `evaluate` y `removeEvaluation` (validan taller `active`/no cerrado, escala y que el estudiante siga activo, y **recalculan la calificación** de la habilidad del estudiante), `recalculateStudentSkill`, `listByAttendance` |
| `workshops` | `WorkshopsService` | CRUD de talleres con ciclo de vida (§3.6: transiciones, fechas por estado, solo `planned` editable, con asistencias no se elimina); `addSkill` y `removeSkill` (solo en `planned`; no se quita con evaluaciones; recalculan calificaciones), `listSkills` |
| `attendance` | `AttendanceService` | `register` (§3.8: taller `active`, estudiante activo, fecha válida, una por día), `listByWorkshop`, `listByStudent`, `update` (con el taller cerrado solo la observación; si cambia la fecha, recalcula calificaciones), `delete` (no con el taller cerrado; recalcula calificaciones) |
| `evidences` | `EvidencesService` | `upload` (1 a 50 estudiantes activos, de forma atómica), `update`, `delete` (oculta también sus relaciones), `linkStudent` (estudiante activo, máx. 50), `unlinkStudent` (no el último), `listByStudent`, `listStudents` |
| `credentials` | `CredentialsService` | `register` (nace `pending`; taller opcional `finished` y con asistencia), `update` (transiciones; datos solo en `pending`), `listByStudent`, `delete` (solo `pending`) |

Ejemplo de uso:

```ts
import { createContainer } from "./container.js";

const app = createContainer();
const attendance = await app.attendance.register({ studentId: 1n, workshopId: 3n }, actorId);
await app.evaluations.evaluate(
  { workshopAttendanceId: attendance.id, workshopSkillId: 7n, evaluationScaleId: 2n },
  actorId,
);
```

### Cómo agregar una feature nueva

1. Crear la tabla en `database/asisco_login_supabase.sql` y llamar a `select public.habilitar_auditoria('<tabla>', '<pk>', ...)`.
2. Reflejarla en `prisma/schema.prisma` con `@@schema("public")`, las 6 columnas de auditoría y `onDelete: Restrict`. Luego ejecutar `npm run prisma:generate`.
3. Crear `src/<feature>/domain/`: la entidad, que extiende `AuditableEntity`, y la interfaz del repositorio, con `actor` en los métodos que escriben.
4. Crear `src/<feature>/application/<feature>.service.ts`, que reciba las interfaces por constructor.
5. Crear `src/<feature>/infrastructure/prisma-<entity>.repository.ts`. Debe usar `auditSelect`, `notDeleted` y `audit.*(actor)`, y su `delete` debe hacer un `update` con `audit.delete`.
6. Exportar dominio y aplicación en `src/<feature>/index.ts` y registrar la feature en `src/container.ts`.
7. Crear `src/<feature>/http/<feature>.routes.ts`, montarlo en `src/shared/http/app.ts` y documentar sus rutas (y cuerpos) en `scripts/request-catalog.ts`. Ejecutar `npm run docs:requests`.
8. Ejecutar `npm run typecheck`.

---

## 5. Advertencias

- ⚠️ **No ejecutar `prisma migrate dev` ni `prisma db push` contra la BD general.** El schema no contiene las tablas de los demás módulos, así que Prisma intentaría eliminarlas.
- **Solo en el script SQL:** la FK `perfiles.id → auth.users.id`, los checks, los triggers y RLS. Prisma no los expresa.
- **El actor es obligatorio:** desde Prisma, `auth.uid()` es null, así que si un repositorio no envía `actor`, `creado_por`/`actualizado_por` quedan sin dato.
- **`DELETE` desde Supabase:** un `DELETE` hecho por PostgREST responde 0 filas afectadas, porque el trigger lo convierte en borrado lógico.
- **Lectura del esquema administrativo:** el rol con el que se conecta el backend necesita permiso de lectura sobre ese esquema.

## 6. Tareas pendientes

- [ ] El equipo monta la BD general en Supabase ejecutando `database/asisco_login_supabase.sql`.
- [ ] Confirmar con el módulo administrativo:
  - El nombre de su esquema.
  - La nulabilidad de sus columnas.
  - Los catálogos de `sex`, `document_type`, `status_id` y `legal_status_id`.
  - Los permisos de lectura para este módulo.
- [ ] Definir el alcance definitivo de los administrativos: tabla propia, datos del módulo administrativo y permisos.
- [ ] BD de pruebas del módulo: completar la contraseña en `.env`, ejecutar los dos SQL (§2.1) y pasar `npm run db:check` contra Supabase.
- [ ] BD general: reemplazar las URLs en `.env`, confirmar el nombre del esquema administrativo y comparar con `prisma db pull --print`.
- [ ] Probar los repositorios y las políticas RLS en Supabase con usuarios reales.
- [ ] Hacer atómicos el cambio y su recálculo (transacción). Hoy, si el recálculo falla (p. ej. un promedio cae en un hueco entre escalas), el cambio ya quedó guardado y la calificación queda desactualizada hasta el próximo recálculo.
- [ ] Decidir qué pasa con las calificaciones ya calculadas si cambia el `num_value` o el intervalo de una escala.
- [ ] Ligar el `actor` (cuenta) con su tallerista para que solo el tallerista del taller pueda evaluar (§3.9 de VALIDACIONES.md).
- [x] Capa de entrada HTTP: Express 5 bajo `/api/v1`, actor del JWT de Supabase ([ADR-002](decisiones/ADR-002-capa-http-express.md)).
- [ ] Configurar `SUPABASE_URL` y probar la API con un `access_token` real de Supabase.
- [ ] Autorización por rol en las rutas (hoy cualquier perfil activo puede llamar a todas).
