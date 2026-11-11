# SonUp · Módulo de seguimiento y desarrollo de estudiantes (backend)

Backend del módulo de **talleres, habilidades y evidencias** del proyecto integrador SonUp (Asisco UP). Registra los talleres que dicta cada tallerista, la asistencia y evaluación de los jóvenes, calcula sus calificaciones por habilidad y guarda sus evidencias y certificados.

- **Stack:** TypeScript (ESM) · Express 5 · Prisma 7 · Zod 4 · PostgreSQL (Supabase).
- **Datos personales** (jóvenes, acudientes, talleristas, personal): los administra el módulo administrativo **Saga**. Aquí solo se **leen**, por su API.
- **Login y roles:** los emite el **servicio de seguridad**. Aquí se verifica el JWT y se protege cada ruta por rol.
- **Despliegue:** API en Render (`/api`) y documentación interactiva en `/api-docs` (Swagger).

> Referencia detallada: [docs/CONTEXTO_Y_ARQUITECTURA.md](docs/CONTEXTO_Y_ARQUITECTURA.md) (modelo y arquitectura) · [docs/VALIDACIONES.md](docs/VALIDACIONES.md) (reglas por tabla) · [docs/api/CUERPOS_DE_PETICION.md](docs/api/CUERPOS_DE_PETICION.md) (cuerpos y ejemplos) · [docs/decisiones/](docs/decisiones/) (ADR).

## Contenido

1. [Puesta en marcha](#1-puesta-en-marcha)
2. [Arquitectura](#2-arquitectura)
3. [Esquemas de la base de datos](#3-esquemas-de-la-base-de-datos)
4. [Capa de dominio](#4-capa-de-dominio)
5. [Capa de infraestructura](#5-capa-de-infraestructura)
6. [Capa de aplicación](#6-capa-de-aplicación)
7. [Capa HTTP: rutas y permisos por rol](#7-capa-http-rutas-y-permisos-por-rol)
8. [Decisiones de arquitectura (ADR)](#8-decisiones-de-arquitectura-adr)

---

## 1. Puesta en marcha

```bash
npm install            # también genera el cliente de Prisma (postinstall)
cp .env.example .env   # y completar las variables
npm run dev            # API en http://localhost:3000/api (recarga al guardar)
```

| Comando | Para qué |
|---|---|
| `npm run dev` / `npm start` | Arrancar la API (con o sin recarga) |
| `npm run typecheck` | Verificar tipos; se corre después de cada cambio |
| `npm run db:check` | Verificar la conexión y el estado de la BD del `.env` (solo lectura) |
| `npm run db:seed:dev` | Datos de prueba en la BD de pruebas, vía servicios (idempotente) |
| `npm run docs:requests` | Regenerar los cuerpos de petición, las colecciones de Postman y el Swagger desde `scripts/request-catalog.ts` |
| `npm run prisma:validate` / `prisma:generate` | Después de tocar `prisma/schema.prisma` |

**Variables principales** (lista completa en [.env.example](.env.example) y en CONTEXTO §2):

| Variable | Uso |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Conexión a Supabase: pooler de transacciones (6543) para la app y de sesión (5432) para la CLI |
| `JWT_SECRET` | Secreto HS256 compartido con el servicio de seguridad. **Obligatorio en producción** |
| `SAGA_API_URL` | API de Saga. Sin ella se leen las tablas simuladas del esquema `administrativo` (solo desarrollo) |
| `RENDER_API_URL` | Servicio de autenticación (registro, login, perfil) |
| `NODE_ENV=production` | Desactiva las cabeceras de desarrollo `X-Actor-Id`/`X-Actor-Roles`. **Obligatoria al desplegar** |
| `CORS_ORIGIN` / `PUBLIC_URL` | Orígenes permitidos y URL pública (servidor de Swagger) |

> ⚠️ **Nunca** `prisma migrate dev`, `migrate reset` ni `db push`: la BD es compartida y el schema solo tiene nuestras tablas, así que Prisma intentaría borrar las de los demás módulos. Las tablas se crean con el SQL ([§3](#3-esquemas-de-la-base-de-datos)).

---

## 2. Arquitectura

**Arquitectura por features con inversión de dependencias.** Cada feature tiene las mismas cuatro capas y **un archivo por entidad en cada capa** ([ADR-004](docs/decisiones/ADR-004-un-archivo-por-entidad.md)).

```
Petición → http (router) → application (servicio) → domain (puerto) ← infrastructure (Prisma / Saga)
                                                         ▲
                                   src/container.ts conecta implementaciones y servicios
```

| Capa | Archivos | Hace | No hace |
|---|---|---|---|
| **http** | `<entities>.routes.ts`, `<feature>.catalog.ts` | Lee parámetros (Zod), obtiene el `actor`, aplica la política de acceso y llama al servicio | Reglas de negocio ni acceso a datos |
| **application** | `<entities>.service.ts`, `<entity>.schemas.ts` | Casos de uso, reglas de negocio, validación de entrada (Zod) | Saber de HTTP o de Prisma |
| **domain** | `<entity>.entity.ts`, `<entity>.repository.ts` / `.reader.ts`, `<entity>.rules.ts` | Entidades, DTOs, puertos y reglas puras | Importar nada externo |
| **infrastructure** | `prisma-<entity>.repository.ts`, `saga/saga-<entity>.reader.ts` | Implementa los puertos, mapea filas a entidades y traduce errores | Reglas de negocio |

**Features** (`src/`):

| Feature | Entidades | Tipo |
|---|---|---|
| `skills` | `skill_categories`, `skills`, `student_skills` | Propia |
| `evaluations` | `evaluation_scales`, `evaluation_skills` (+ cálculo de calificaciones) | Propia |
| `workshops` | `workshops`, `workshop_skills`, `workshop_attendances` | Propia |
| `evidences` | `evidences`, `student_evidences`, `credentials` | Propia |
| `administrative` | `children`, `guardians`, `children_guardians`, `professionals`, `staff` | **Solo lectura** (Saga) |
| `auth` | Sesión, verificación del token, enlace con Saga, política de acceso | Remite al servicio de seguridad |
| `profiles`, `access` | `perfiles`, `aplicaciones`, `roles`, `usuario_roles` | Heredadas del script de login |
| `shared` | Auditoría, errores, fechas, esquemas comunes, capa HTTP común | Transversal |

---

## 3. Esquemas de la base de datos

**Fuente de verdad:** [database/asisco_login_supabase.sql](database/asisco_login_supabase.sql). [prisma/schema.prisma](prisma/schema.prisma) la refleja y el dominio baja de ahí. Todo cambio de datos propios empieza en el SQL; los cambios sobre una BD ya creada van en [database/migraciones/](database/migraciones/).

### 3.1 Reglas que aplican a todas nuestras tablas

| Regla | Cómo se aplica en la BD |
|---|---|
| **Auditoría** | `habilitar_auditoria(tabla, pk)` agrega `creado_en/por`, `actualizado_en/por` y `eliminado_en/por`, más el trigger `auditar()`: pone las fechas con `now()`, hace inmutables los datos de creación y registra quién eliminó o restauró. El actor es el `sub` del token (texto) |
| **Borrado lógico** | El trigger `borrado_logico()` convierte todo `DELETE` en `eliminado_en = now()`. La purga real solo es posible con `set local asisco.permitir_borrado_fisico = 'on'` |
| **Sin cascadas** | Todas las FK son `on delete restrict` |
| **Restaurar en vez de duplicar** | Las relaciones únicas (habilidad de un taller, evaluación, estudiante de una evidencia, calificación) restauran la fila eliminada en lugar de crear otra |
| **Datos de otros módulos** | `student_id` y `evaluator_id` son `bigint` **sin FK física**: Saga es dueño de esas tablas y la existencia se valida en los servicios |
| **Textos** | `check` de longitud y "sin espacios sobrantes" (`name = btrim(name) and name !~ '\s{2,}'`) |
| **URLs** | `check (char_length(url) <= 2048 and url ~ '^https://\S+$')` |
| **RLS** | Activado en todas las tablas: protege el acceso directo por Supabase (PostgREST). La administración gestiona todo y los catálogos los lee cualquier usuario autenticado. El backend se conecta con un rol que no aplica RLS y protege sus rutas por rol ([§7](#7-capa-http-rutas-y-permisos-por-rol)) |

### 3.2 Reglas por tabla

Los tres niveles de validación ([VALIDACIONES.md §1](docs/VALIDACIONES.md)) son: **1** esquema de entrada (Zod), **2** servicio, **3** BD. Esta tabla resume lo que exige la **BD**; las reglas que solo valida el servicio están en la §6 y en VALIDACIONES §3.

| Tabla | Restricciones en la BD |
|---|---|
| `skill_categories` | `name` 2–100, **único sin distinguir mayúsculas** (índice sobre `lower(name)`); `description` ≤ 500 |
| `skills` | `name` 2–100, **único por categoría** sin distinguir mayúsculas (`(skill_category_id, lower(name))`); `status` ∈ `active`, `inactive` |
| `evaluation_scales` | `code` `^[A-Z0-9_]{1,30}$` único; `name` único sin distinguir mayúsculas; `num_value`, `min_value` y `max_value` en **0–5** con `min ≤ num ≤ max`. Entre escalas vigentes (activas y no eliminadas): **intervalos sin solapamiento** (restricción de exclusión `gist` sobre `numrange(min, max, '[]')`) y `num_value` único |
| `student_skills` | Único (`student_id`, `skill_id`); `evaluation_scale_id` con FK a la escala |
| `workshops` | `name` 3–150; `status` ∈ `planned`, `active`, `finished`, `cancelled`; `ends_at ≥ starts_at`; `active` y `finished` exigen `starts_at`; `finished` exige `ends_at` |
| `workshop_skills` | Único (`workshop_id`, `skill_id`) |
| `workshop_attendances` | `observation` ≤ 1000; **una asistencia vigente por estudiante, taller y día** en hora de Bogotá (índice único parcial sobre `(workshop_id, student_id, (attended_at at time zone 'America/Bogota')::date)`) |
| `evaluation_skills` | Única (`workshop_attendance_id`, `workshop_skill_id`) |
| `evidences` | `url` https ≤ 2048; `title` 2–150; `type` ∈ `IMAGE`, `VIDEO` |
| `student_evidences` | Única (`student_id`, `evidence_id`) |
| `credentials` | `organization_name` 2–150; `url` https ≤ 2048; `status` ∈ `pending`, `valid`, `revoked`; `workshop_id` opcional con FK |

Cuando la BD rechaza algo, `withPrismaErrors` lo traduce: `check`/`not null` → `ValidationError` (400), `unique`/exclusión → `ConflictError` (409), FK → `ValidationError` (400).

### 3.3 Esquemas de entrada (Zod, nivel 1)

Cada entidad tiene sus esquemas en `src/<feature>/application/<entity>.schemas.ts` ([ADR-001](docs/decisiones/ADR-001-zod-esquemas-de-entrada.md)):

- `z.strictObject`: se rechazan los campos desconocidos, incluidas las columnas de auditoría.
- Opcionales con `.exactOptional()`. Se normaliza: `trim`, vacío → `null`, mayúsculas o minúsculas según el campo.
- Se reutilizan los esquemas de [src/shared/application/schemas.ts](src/shared/application/schemas.ts): id, nombre, texto, URL https, fecha, documento…
- `parseInput` convierte el `ZodError` en `ValidationError` con `details: [{ path, message }]` en español.

---

## 4. Capa de dominio

`src/<feature>/domain/`: no importa nada externo, ni Prisma, ni Zod, ni Express.

- **Entidades:** todas las de nuestras tablas extienden `AuditableEntity` ([src/shared/domain/auditable.ts](src/shared/domain/auditable.ts)). Los estados son tipos unión con los mismos valores de la BD (`WorkshopStatus`, `CredentialStatus`, `EvidenceType`…).
- **Puertos:**
  - `*Repository` (lectura y escritura; todo método que escribe recibe `actor: ActorId`).
  - `*Reader` (solo lectura, para Saga: `ChildReader`, `GuardianReader`, `ChildGuardianReader`, `ProfessionalReader`, `StaffReader`).
  - `SkillGradeRecalculator`: talleres y asistencias piden recalcular calificaciones sin conocer al servicio que lo hace.
  - `TokenVerifier`, `AuthGateway` y `ActorLinksResolver` (auth).
- **Reglas puras** (`*.rules.ts`, `grading.ts`):
  - `workshop.rules.ts` y `credential.rules.ts`: máquinas de estado (qué transición se permite y qué se edita en cada estado).
  - `attendance.rules.ts`: fecha válida, día en Bogotá.
  - `evaluation-skill.rules.ts`: cuándo se evalúa o se elimina.
  - `grading.ts`: `accumulateSkillGrade`, `findScaleForValue`, `roundGrade`, `average`.
- **Errores de dominio** ([src/shared/domain/errors.ts](src/shared/domain/errors.ts)): `ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `ExternalServiceError` (Saga o el servicio de seguridad: 429 si limita peticiones, 502/503 si falla o no está configurado, 504 si no respondió a tiempo).

---

## 5. Capa de infraestructura

`src/<feature>/infrastructure/`: la única capa que conoce Prisma y la API de Saga.

| Pieza | Qué hace |
|---|---|
| `prisma-<entity>.repository.ts` | Implementa el puerto con `select` explícito y un mapeo `toX()` que devuelve entidades de dominio, nunca tipos de Prisma. Filtra `notDeleted` por defecto (`includeDeleted` para ver eliminados). Escribe con `audit.create/update/delete/restore(actor)`; su `delete` es un `update` |
| `shared/infrastructure/prisma/` | `prisma.client.ts` (único punto de importación de Prisma), `audit.ts`, `prisma-errors.ts` (`withPrismaErrors`), `mappers.ts` (decimales) |
| `administrative/infrastructure/saga/` | `SagaHttpClient` (solo `GET`, con tiempo límite) y lectores `Saga*Reader`. Reenvía el token del usuario de la petición (`request-context.ts`, `AsyncLocalStorage`) o, fuera de una petición, el del usuario de servicio (`saga-token.source.ts`) |
| `administrative/infrastructure/prisma-*.reader.ts` | Lectores sobre las tablas simuladas del esquema `administrativo`; se usan solo sin `SAGA_API_URL` |
| `auth/infrastructure/` | `JwtTokenVerifier` (HS256 con `JWT_SECRET`, sin consultar al servidor de seguridad), `HttpAdministrativeAuthGateway` (registro, login, perfil) y `administrative-auth.mapper.ts` (único que conoce el formato de ese servicio) |

[src/container.ts](src/container.ts) es la raíz de composición: elige Saga o el simulado según `SAGA_API_URL`, crea el verificador de tokens (y se niega a arrancar en producción sin `JWT_SECRET`) e inyecta los puertos en los servicios.

---

## 6. Capa de aplicación

`src/<feature>/application/`: casos de uso. Los servicios no saben de HTTP, así que se usan igual desde una ruta, un script o una prueba. Cada servicio valida la forma con Zod y después aplica las reglas de negocio. Lo más interesante:

### 6.1 Recalcular la calificación de una habilidad (`GradingService`)

La calificación de un joven en una habilidad (`student_skills`) **no se asigna a mano: se calcula** a partir de su historial de evaluaciones.

**Regla** ([src/evaluations/domain/grading.ts](src/evaluations/domain/grading.ts)):
1. Recorre las evaluaciones vigentes del joven en esa habilidad, en orden de fecha de asistencia.
2. La primera evaluación es su escala tal cual.
3. Cada evaluación siguiente se promedia con la calificación anterior, `(num_value anterior + num_value nueva) / 2`, **se redondea a 2 decimales** y se clasifica en la escala activa cuyo intervalo `[min, max]` contiene el valor.
4. Sin evaluaciones vigentes, la calificación se elimina (borrado lógico). Si el valor cae en un hueco entre escalas → `ValidationError`.

**Ejemplo** con las escalas de despliegue: `I` (1) [0–1.99], `NR` (2.5) [2–2.99], `EP` (3.5) [3–3.99], `L` (4.5) [4–5]:

| Evaluación | Cálculo | Calificación |
|---|---|---|
| `I` (1) | — | `I` |
| `NR` (2.5) | (1 + 2.5) / 2 = 1.75 | `I` |
| `L` (4.5) | (1 + 4.5) / 2 = 2.75 | `NR` |

Como se guarda la **escala** y no el número, cada paso parte del `num_value` de la escala anterior.

**Siempre recalcula desde el historial completo**, así que el resultado es correcto aunque se cambie o se borre algo del pasado. **Se dispara en estos escenarios:**

| Escenario | Quién lo pide | Qué recalcula |
|---|---|---|
| Evaluar o reevaluar (`POST /evaluations`) | `EvaluationsService.evaluate` | La habilidad evaluada del joven |
| Eliminar una evaluación | `EvaluationsService.remove` | Esa habilidad del joven |
| **Cambiar la fecha** de una asistencia | `AttendanceService.update` | Todas las habilidades evaluadas en esa asistencia (cambia el orden cronológico) |
| **Eliminar una asistencia** | `AttendanceService.delete` | Todas las habilidades evaluadas en ella |
| Quitar o volver a asociar una habilidad a un taller | `WorkshopSkillsService.remove` / `add` | Todos los jóvenes evaluados en esa habilidad del taller |
| A mano (p. ej. tras ajustar escalas) | `POST /students/:id/skills/:skillId/recalculate` | Esa habilidad del joven |

Talleres y asistencias dependen solo del puerto `SkillGradeRecalculator`, no de `GradingService`.

**Promedio por categoría** (`StudentSkillsService.getCategoryAverages`): promedio de los `num_value` de las habilidades calificadas de cada categoría, redondeado y clasificado en su escala. `listByStudent` devuelve cada calificación con el nombre de la habilidad, su categoría y su escala.

> Pendiente: hacer atómicos el cambio y su recálculo (transacción).

### 6.2 Ciclo de vida de un taller (`WorkshopsService`, `WorkshopSkillsService`)

```
planned ──▶ active ──▶ finished
   └────┬──────┘
        ▼
    cancelled          (finished y cancelled son finales)
```

- **Nace siempre `planned`.** Solo en ese estado se edita (nombre, fechas, tallerista) y se agregan o quitan habilidades.
- **Para activarlo** necesita `starts_at` y al menos una habilidad.
- **Para finalizarlo** necesita `ends_at`, que no puede ser anterior a la última asistencia.
- **Con asistencias no se elimina, se cancela.** No se saltan estados ni se reabre.
- Solo se asocian habilidades `active`. No se quita una habilidad con evaluaciones vigentes.

### 6.3 Asistencia y evaluación (`AttendanceService`, `EvaluationsService`)

- **Asistencia** solo en talleres `active`, de un joven **activo** en Saga (sin `exit_date` pasada), con fecha no futura y dentro de las fechas del taller. Una por joven, taller y día (hora de Bogotá).
- **Con el taller cerrado** solo se corrige la observación: no se cambia la fecha ni se elimina.
- **Evaluación:** la habilidad debe ser del mismo taller de la asistencia, la escala debe estar activa y el taller `active`. Reevaluar cambia la escala. Con el taller cerrado, las evaluaciones son historial.

### 6.4 Evidencias y certificados

- **`EvidencesService.upload`:** guarda la evidencia y sus **1 a 50 jóvenes activos en una sola operación**. Al eliminarla se ocultan también sus relaciones. `StudentEvidencesService` no deja quitar el último joven.
- **`CredentialsService`:** nace `pending` → `valid` → `revoked`. Si se asocia a un taller, este debe estar `finished` y el joven debe haber asistido. Solo `pending` se edita o elimina.

### 6.5 Escalas de evaluación (`EvaluationScalesService`)

- Mantiene el rango 0–5 sin solapamientos entre escalas vigentes.
- `getCoverageGaps()` devuelve los tramos sin escala y `classify(valor)` dice en qué escala cae un valor.
- **Una escala en uso** congela `code`, `num_value`, `min_value` y `max_value`, para que no cambien las calificaciones históricas. No se elimina: se inactiva.

### 6.6 Sesión y enlace con Saga (`AuthService`, `ActorLinksService`, `AccessPolicy`)

- **`AuthService`:** remite registro, login y perfil al servicio de seguridad ([ADR-003](docs/decisiones/ADR-003-autenticacion-modulo-administrativo.md)). Enriquece la respuesta con `expiresAt` y el bloque `saga`: `professionalId`, `staffId`, `childId`, `guardianId`, `childIds`.
- **`ActorLinksService`:** resuelve a quién de Saga corresponde el usuario. Saga guarda el `sub` del token en `security_user_id` de `staff`, `children` y `guardians`. El resultado se cachea `AUTH_LINK_CACHE_SECONDS`.
- **`AccessPolicy`:** decide **a qué registros** accede cada rol ("lo suyo"). Ver [§7.2](#72-qué-ve-cada-rol-lo-suyo).

---

## 7. Capa HTTP: rutas y permisos por rol

Express 5 bajo **`/api`** ([ADR-002](docs/decisiones/ADR-002-capa-http-express.md)): un router por entidad, reunidos en el catálogo de cada feature (`<feature>.catalog.ts`) y en [src/shared/http/api.routes.ts](src/shared/http/api.routes.ts). Swagger UI en **`/api-docs`**, generado desde [scripts/request-catalog.ts](scripts/request-catalog.ts) ([ADR-005](docs/decisiones/ADR-005-swagger-desde-el-catalogo.md)).

### 7.1 Cómo se protege una petición ([ADR-008](docs/decisiones/ADR-008-seguridad-por-roles.md))

```
Authorization: Bearer <JWT> ─▶ authenticate ─▶ authorize (matriz) ─▶ AccessPolicy ("lo suyo") ─▶ servicio
                               (sub + roles)    (¿el rol entra?)      (¿a este registro?)
```

1. **`authenticate`:** verifica el JWT localmente (HS256, `JWT_SECRET`) y obtiene `sub` (el actor de la auditoría) y `roles`. Fuera de producción también acepta `X-Actor-Id` + `X-Actor-Roles`.
2. **`authorize`:** consulta la matriz [src/shared/http/route-permissions.ts](src/shared/http/route-permissions.ts), único lugar donde se decide **qué rol** entra a cada ruta. Si el rol no está permitido → 403.
3. **`AccessPolicy`:** dentro de la ruta, decide **a qué registros**. Por ejemplo, un joven solo ve sus calificaciones.
4. **`errorHandler`:** traduce los errores de dominio a HTTP con el formato `{ error: { code, message, details? } }`.

**Roles:** `ADMIN` (todo), `TALLERISTA`, `ESTUDIANTE`, `ACUDIENTE` ([src/auth/domain/roles.ts](src/auth/domain/roles.ts)). `DONANTE` existe en el servicio de seguridad, pero aún no tiene acceso a este módulo.

### 7.2 Qué ve cada rol ("lo suyo")

| Rol | Talleres | Jóvenes (datos, calificaciones, asistencias, evidencias, certificados) | Perfiles de Saga |
|---|---|---|---|
| `ADMIN` | Todos, también los eliminados (`includeDeleted`) | Todos | Todos |
| `TALLERISTA` | **Solo los suyos** (`evaluatorId` = su `professionalId`): los lista, crea, edita, gestiona sus habilidades, asistencias y evaluaciones | Todos, con la anamnesis (`notes`), para tenerla en cuenta al evaluar | Solo su propio `staff` y `professional` |
| `ESTUDIANTE` | Los **disponibles** (`planned`, `active`) y aquellos a los que asistió. Su historial está en sus asistencias | **Solo él mismo** (su `childId`) | — |
| `ACUDIENTE` | Igual que el estudiante | **Solo sus jóvenes** (vínculos vigentes en `children_guardians`) | Solo su propio registro de acudiente |

- **Cuentas con varios roles** (p. ej. `TALLERISTA` + `ACUDIENTE`): se suman los accesos de cada rol.
- **Cuenta sin enlace en Saga** (sin `security_user_id`): las rutas de "lo suyo" responden 403 con el mensaje de cómo enlazarse.
- **Registro que no existe:** la política no bloquea y el servicio responde 404.

### 7.3 Rutas

**Leyenda de roles:** **A** `ADMIN` · **T** `TALLERISTA` · **E** `ESTUDIANTE` · **Ac** `ACUDIENTE`. La columna "Filtro" indica la regla de [§7.2](#72-qué-ve-cada-rol-lo-suyo) que se aplica a los roles distintos de `ADMIN`.

**Públicas** (sin token)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| POST | `/auth/register` | Registrar usuario (se remite al servicio de seguridad) |
| POST | `/auth/login` | Iniciar sesión: token, `expiresAt`, roles y bloque `saga` |
| GET | `/auth/profile` | Dueño del token, con `expiresAt` y sus ids de Saga (requiere el token, no la matriz) |

**Módulo administrativo (Saga, solo lectura)**

| Método | Ruta | Roles | Filtro / consulta |
|---|---|---|---|
| GET | `/children` | A, T | Consulta: `statusId`, `search`. Incluye la anamnesis (`notes`) |
| GET | `/children/by-document/:documentNumber` | A, T | — |
| GET | `/children/:id` | A, T, E, Ac | E: él mismo · Ac: sus jóvenes |
| GET | `/children/:id/guardians` | A, T, E, Ac | Igual · Consulta: `activeOnly` (por defecto `true`) |
| GET | `/guardians` | A | Consulta: `search` |
| GET | `/guardians/:id` | A, Ac | Ac: solo él mismo |
| GET | `/guardians/:id/children` | A, Ac | Ac: solo él mismo · Consulta: `activeOnly` |
| GET | `/professionals` | A | Consulta: `timeDonor` |
| GET | `/professionals/by-staff/:staffId` | A, T | T: solo su `staffId` |
| GET | `/professionals/:id` | A, T | T: solo su `professionalId` |
| GET | `/staff` | A | Consulta: `roleId`, `statusId`, `search` |
| GET | `/staff/:id` | A, T | T: solo su `staffId` |

**Habilidades y escalas**

| Método | Ruta | Roles | Filtro / consulta |
|---|---|---|---|
| GET | `/skill-categories`, `/skill-categories/:id` | A, T | — |
| POST · PATCH · DELETE | `/skill-categories[/:id]` | A | No se elimina con habilidades vigentes |
| GET | `/skills` | A, T | Consulta: `skillCategoryId`, `status`, `search`, `includeDeleted` |
| GET | `/skills/:id` | A, T | — |
| POST · PATCH · DELETE | `/skills[/:id]` | A | Con historial no se elimina: se inactiva |
| GET | `/evaluation-scales`, `/evaluation-scales/:id` | A, T, E, Ac | La leyenda de los niveles, ordenada por `numValue` · Consulta: `activeOnly` |
| GET | `/evaluation-scales/coverage-gaps` | A, T | Tramos de 0–5 sin escala |
| GET | `/evaluation-scales/classify` | A, T | Consulta: `value` (obligatorio) |
| POST · PATCH · DELETE | `/evaluation-scales[/:id]` | A | En uso: valores fijos y no se elimina |
| GET | `/students/:studentId/skills` | A, T, E, Ac | E: él mismo · Ac: sus jóvenes. Con `skillName`, `categoryName` y `scale` |
| GET | `/students/:studentId/category-averages` | A, T, E, Ac | Igual. Promedio y escala por categoría |

**Talleres**

| Método | Ruta | Roles | Filtro / consulta |
|---|---|---|---|
| GET | `/workshops` | A, T, E, Ac | Consulta: `evaluatorId`, `status`, `search`, `includeDeleted` (solo A). T: se fuerza `evaluatorId` = el suyo (otro → 403) · E/Ac: se fuerza `status` ∈ `planned`, `active` (otro → 403) |
| GET | `/workshops/:id` | A, T, E, Ac | T: suyo · E/Ac: disponible o al que asistieron |
| POST | `/workshops` | A, T | T: solo a su nombre (`evaluatorId` = el suyo). Nace `planned` |
| PATCH | `/workshops/:id` | A, T | T: suyo, sin pasárselo a otro tallerista. Edita (solo `planned`) o cambia de estado |
| DELETE | `/workshops/:id` | A, T | T: suyo. Sin asistencias |
| GET | `/workshops/:id/skills` | A, T, E, Ac | Mismo filtro que `GET /workshops/:id` |
| PUT · DELETE | `/workshops/:id/skills/:skillId` | A, T | T: suyo. Solo en `planned`; recalcula |

**Asistencias y evaluaciones**

| Método | Ruta | Roles | Filtro / consulta |
|---|---|---|---|
| GET | `/workshops/:id/attendances` | A, T | T: suyo |
| GET | `/students/:studentId/attendances` | A, T, E, Ac | E: él mismo · Ac: sus jóvenes (su historial de talleres) |
| POST | `/attendances` | A, T | T: en sus talleres (`workshopId` del cuerpo) |
| GET | `/attendances/:id` | A, T, E, Ac | T: en sus talleres · E/Ac: la suya o la de sus jóvenes |
| PATCH · DELETE | `/attendances/:id` | A, T | T: en sus talleres. Recalcula |
| POST | `/evaluations` | A, T | T: en sus talleres (`workshopAttendanceId` del cuerpo). Recalcula |
| GET | `/attendances/:attendanceId/evaluations` | A, T, E, Ac | Mismo filtro que `GET /attendances/:id` |
| DELETE | `/attendances/:attendanceId/evaluations/:workshopSkillId` | A, T | T: en sus talleres. Recalcula |
| POST | `/students/:studentId/skills/:skillId/recalculate` | A | Recalcular a mano |

**Evidencias y certificados**

| Método | Ruta | Roles | Filtro / consulta |
|---|---|---|---|
| POST | `/evidences` | A, T | 1 a 50 jóvenes activos; `type` `IMAGE` o `VIDEO` |
| GET | `/evidences/:id` | A, T, E, Ac | E/Ac: solo si aparece él o uno de sus jóvenes |
| PATCH · DELETE | `/evidences/:id` | A, T | — |
| GET | `/evidences/:id/students` | A, T, E, Ac | Mismo filtro que `GET /evidences/:id` |
| PUT · DELETE | `/evidences/:id/students/:studentId` | A, T | No se quita el último joven |
| GET | `/students/:studentId/evidences` | A, T, E, Ac | E: él mismo · Ac: sus jóvenes |
| POST | `/credentials` | A, T | Nace `pending` |
| GET | `/credentials/:id` | A, T, E, Ac | E: la suya · Ac: la de sus jóvenes |
| PATCH · DELETE | `/credentials/:id` | A, T | Datos y borrado solo en `pending` |
| GET | `/students/:studentId/credentials` | A, T, E, Ac | E: él mismo · Ac: sus jóvenes |

> En evidencias y certificados, cualquier tallerista puede escribir, no solo el del taller: la matriz no limita esas escrituras a "lo suyo".

**Cuentas y acceso heredados** (solo `ADMIN`): `/profiles` (`GET`, `GET /me`, `GET/PATCH/DELETE /:id`, `POST /:id/restore`, `GET /:userId/roles[/:role]`), `/apps` (`GET`, `POST`), `/roles` (`GET`, `POST`), `/user-roles` (`POST`, `DELETE /:id`). Su propiedad está por acordar con el equipo de seguridad.

> **Al agregar una ruta:** el router, su entrada en `ROUTE_PERMISSIONS` y su entrada en `routes` de `scripts/request-catalog.ts`. Después, `npm run docs:requests` (falla si falta alguna de las tres).

---

## 8. Decisiones de arquitectura (ADR)

Cada decisión que agrega una dependencia o cambia la arquitectura queda en [docs/decisiones/](docs/decisiones/), con contexto, decisión, alternativas y consecuencias.

| ADR | Decisión | En una línea |
|---|---|---|
| [001](docs/decisiones/ADR-001-zod-esquemas-de-entrada.md) | **Zod** para los esquemas de entrada | La forma del dato (nivel 1) se valida con esquemas `strictObject` en `application`; las reglas de negocio siguen en los servicios |
| [002](docs/decisiones/ADR-002-capa-http-express.md) | **Express 5** como capa HTTP | Un router por entidad bajo `/api`, sin reglas de negocio; errores de dominio → HTTP en un solo `errorHandler` |
| [003](docs/decisiones/ADR-003-autenticacion-modulo-administrativo.md) | **Autenticación delegada** | Registro, login y perfil se remiten al servicio de seguridad por el puerto `AuthGateway`; su formato solo lo conoce un mapper |
| [004](docs/decisiones/ADR-004-un-archivo-por-entidad.md) | **Un archivo por entidad** en cada capa | `<entity>.entity.ts`, `.repository.ts`, `<entities>.service.ts`, `.schemas.ts`, `prisma-<entity>.repository.ts`, `<entities>.routes.ts` |
| [005](docs/decisiones/ADR-005-swagger-desde-el-catalogo.md) | **Swagger** generado desde el catálogo | `scripts/request-catalog.ts` produce Swagger, Postman y los cuerpos de petición, validados contra Zod y Express |
| [006](docs/decisiones/ADR-006-administrativos-desde-saga.md) | **Administrativos desde `staff`** de Saga | No hay tabla propia de administrativos: se leen en solo lectura (se retiró `public.administrators`) |
| [007](docs/decisiones/ADR-007-saga-por-api.md) | **Saga por su API REST** | Lectores `Saga*Reader` (solo `GET`). Sin `SAGA_API_URL`, tablas simuladas para desarrollo |
| [008](docs/decisiones/ADR-008-seguridad-por-roles.md) | **Seguridad por roles** | JWT verificado localmente con `JWT_SECRET`, matriz ruta → rol, `AccessPolicy` para "lo suyo" con el enlace `security_user_id` de Saga, token reenviado a Saga y actor = `sub` |
