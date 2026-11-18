# API: rutas y cuerpos de petición

> **Generado** con `npm run docs:requests` desde `scripts/request-catalog.ts`. No editar a mano: cambia el catálogo y regenera.
> Cada ejemplo se validó contra los esquemas Zod reales (nivel 1, [ADR-001](../decisiones/ADR-001-zod-esquemas-de-entrada.md)) y cada ruta contra las registradas en Express ([ADR-002](../decisiones/ADR-002-capa-http-express.md)).
> Reglas completas por tabla: [VALIDACIONES.md](../VALIDACIONES.md). Colecciones de Postman: [postman-coleccion.json](postman-coleccion.json), con pruebas, y [postman-coleccion-libre.json](postman-coleccion-libre.json), para probar a mano (ver [Uso en Postman](#uso-en-postman)).

## Convenciones generales

| Tema | Regla |
|---|---|
| Base | `http://localhost:3000/api` (`npm run dev`; puerto con `PORT`) |
| Autenticación | `Authorization: Bearer <token del login>` (el mismo token de Saga). Solo fuera de producción: `X-Actor-Id: <id del usuario>` y `X-Actor-Roles: TALLERISTA` (sin roles se asume `ADMIN`) y, para "lo suyo", `X-Actor-Professional-Id`, `X-Actor-Staff-Id`, `X-Actor-Child-Id` o `X-Actor-Guardian-Id`. [ADR-008](../decisiones/ADR-008-seguridad-por-roles.md) |
| Permisos | Roles válidos: `ADMIN` (todo), `TALLERISTA`, `ESTUDIANTE`, `ACUDIENTE` y `DONANTE` (aún sin acceso). Cada ruta admite ciertos roles (columna **Roles**); sin el rol: **403**. Dentro de la ruta, el tallerista solo gestiona **sus** talleres y el joven o acudiente solo ve **lo suyo** (si no, **403**). Matriz en `src/shared/http/route-permissions.ts`; "lo suyo" en `src/auth/application/access-policy.ts`. Públicas: `/health` y `/auth/register`, `/auth/login`, `/auth/profile` (remiten al módulo administrativo, [ADR-003](../decisiones/ADR-003-autenticacion-modulo-administrativo.md)) |
| Formato | Cuerpo JSON (`Content-Type: application/json`) |
| Ids | En la entrada, número o texto con un entero positivo (`12` o `"12"`). En las respuestas, **texto** (`"12"`) |
| Fechas | Texto ISO 8601 con zona: `"2026-10-20T15:00:00Z"`. Las fechas de negocio se interpretan en hora de Bogotá |
| Textos | Se quitan espacios al inicio y al final, y los espacios dobles en nombres y títulos. Un texto opcional vacío se guarda como `null` |
| Campos opcionales | Se pueden omitir. Los marcados `… \| null` aceptan `null` para borrar el valor |
| Campos desconocidos | **Se rechazan** (`Campo no permitido`), tanto en el cuerpo como en la consulta (`?…`) |
| Actualizar | `PATCH`: solo se cambian los campos enviados |
| Eliminar | `DELETE` hace borrado lógico y responde **204** sin cuerpo |
| Actor | No va en el cuerpo: es el usuario autenticado |

**Errores.** Formato único; `details` solo aparece en errores de forma (nivel 1) y trae todos los campos inválidos a la vez:

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Taller: datos de entrada inválidos (name: Debe tener al menos 3 caracteres)",
    "details": [{ "path": "name", "message": "Debe tener al menos 3 caracteres" }]
  }
}
```

| Situación | HTTP | `code` |
|---|---|---|
| Error de forma (esquema) o regla de negocio que invalida la entrada | 400 | `VALIDATION` |
| JSON mal formado | 400 | `BAD_REQUEST` |
| Sin autenticación, o token inválido o vencido | 401 | `UNAUTHORIZED` |
| El rol del usuario no tiene permiso para la ruta | 403 | `FORBIDDEN` |
| No existe (registro o ruta) | 404 | `NOT_FOUND` |
| Conflicto (duplicado, estado que no lo permite) | 409 | `CONFLICT` |
| Demasiados intentos (lo informa el módulo administrativo) | 429 | `EXTERNAL_SERVICE` |
| Error inesperado | 500 | `INTERNAL` |
| Servicio externo caído o con respuesta inesperada | 502 | `EXTERNAL_SERVICE` |
| Servicio externo sin configurar (`RENDER_API_URL`) | 503 | `EXTERNAL_SERVICE` |
| Servicio externo sin respuesta a tiempo | 504 | `EXTERNAL_SERVICE` |

## Rutas por entidad

### Estado

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/health` | Estado del servicio (pública) | Pública |  |  |

### Autenticación

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `POST` | `/auth/register` | Registrar usuario (pública) | Pública |  | [`auth.register`](#authregister) |
| `POST` | `/auth/login` | Iniciar sesión (pública): devuelve el token | Pública |  | [`auth.login`](#authlogin) |
| `GET` | `/auth/profile` | Usuario dueño del token, con `expiresAt` y sus ids de Saga (`saga`) | Pública |  |  |

### Estudiantes

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/children` | Estudiantes (incluye `notes`: la anamnesis del joven, dato sensible) | ADMIN, TALLERISTA | `statusId` (id de catálogo de Saga), `search` |  |
| `GET` | `/children/by-document/:documentNumber` | Estudiante por número de documento (incluye `notes`: la anamnesis del joven, dato sensible) | ADMIN, TALLERISTA |  |  |
| `GET` | `/children/:id` | Estudiante (incluye `notes`: la anamnesis del joven, dato sensible) | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `GET` | `/children/:id/guardians` | Acudientes del estudiante | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE | `activeOnly` (por defecto `true`) |  |

### Acudientes

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/guardians` | Acudientes | ADMIN | `search` |  |
| `GET` | `/guardians/:id` | Acudiente | ADMIN, ACUDIENTE |  |  |
| `GET` | `/guardians/:id/children` | Estudiantes del acudiente (incluye `notes`: la anamnesis del joven, dato sensible) | ADMIN, ACUDIENTE | `activeOnly` (por defecto `true`) |  |

### Talleristas

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/professionals` | Talleristas | ADMIN | `timeDonor` |  |
| `GET` | `/professionals/by-staff/:staffId` | Tallerista por `staff_id` | ADMIN, TALLERISTA |  |  |
| `GET` | `/professionals/:id` | Tallerista | ADMIN, TALLERISTA |  |  |

### Personal (administrativos)

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/staff` | Personal: administrativos y talleristas (solo lectura, Saga) | ADMIN | `roleId`, `statusId` (ids de catálogo de Saga), `search` |  |
| `GET` | `/staff/:id` | Persona del personal (solo lectura, Saga) | ADMIN, TALLERISTA |  |  |

### Acceso (roles y aplicaciones)

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/profiles/:userId/roles` | Roles del usuario | ADMIN | `app` |  |
| `GET` | `/profiles/:userId/roles/:role` | ¿Tiene el rol? → `{ hasRole }` | ADMIN | `app` |  |
| `GET` | `/apps` | Aplicaciones | ADMIN |  |  |
| `POST` | `/apps` | Crear aplicación | ADMIN |  | [`apps.create`](#appscreate) |
| `GET` | `/roles` | Roles | ADMIN |  |  |
| `POST` | `/roles` | Crear rol | ADMIN |  | [`roles.create`](#rolescreate) |
| `POST` | `/user-roles` | Asignar rol | ADMIN |  | [`userRoles.assign`](#userrolesassign) |
| `DELETE` | `/user-roles/:id` | Revocar rol | ADMIN |  |  |

### Perfiles

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/profiles` | Perfiles | ADMIN | `status`, `search`, `includeDeleted` |  |
| `GET` | `/profiles/me` | Perfil del usuario autenticado | ADMIN |  |  |
| `GET` | `/profiles/:id` | Perfil (UUID) | ADMIN |  |  |
| `PATCH` | `/profiles/:id` | Actualizar perfil | ADMIN |  | [`profiles.update`](#profilesupdate) |
| `DELETE` | `/profiles/:id` | Eliminar perfil (lógico) | ADMIN |  |  |
| `POST` | `/profiles/:id/restore` | Restaurar perfil | ADMIN |  |  |

### Categorías de habilidades

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/skill-categories` | Categorías | ADMIN, TALLERISTA |  |  |
| `GET` | `/skill-categories/:id` | Categoría | ADMIN, TALLERISTA |  |  |
| `POST` | `/skill-categories` | Crear categoría | ADMIN |  | [`skillCategories.create`](#skillcategoriescreate) |
| `PATCH` | `/skill-categories/:id` | Actualizar categoría | ADMIN |  | [`skillCategories.update`](#skillcategoriesupdate) |
| `DELETE` | `/skill-categories/:id` | Eliminar categoría (sin habilidades) | ADMIN |  |  |

### Habilidades

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/skills` | Habilidades | ADMIN, TALLERISTA | `skillCategoryId`, `status`, `search`, `includeDeleted` |  |
| `GET` | `/skills/:id` | Habilidad | ADMIN, TALLERISTA |  |  |
| `POST` | `/skills` | Crear habilidad | ADMIN |  | [`skills.create`](#skillscreate) |
| `PATCH` | `/skills/:id` | Actualizar habilidad | ADMIN |  | [`skills.update`](#skillsupdate) |
| `DELETE` | `/skills/:id` | Eliminar habilidad (sin historial) | ADMIN |  |  |

### Escalas de evaluación

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/evaluation-scales` | Escalas, ordenadas por `numValue` (la leyenda de los niveles; la lee cualquier rol) | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE | `activeOnly` (por defecto `true`) |  |
| `GET` | `/evaluation-scales/coverage-gaps` | Tramos de 0–5 sin escala activa | ADMIN, TALLERISTA |  |  |
| `GET` | `/evaluation-scales/classify` | Escala en la que cae un valor | ADMIN, TALLERISTA | `value` (obligatorio) |  |
| `GET` | `/evaluation-scales/:id` | Escala | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `POST` | `/evaluation-scales` | Crear escala | ADMIN |  | [`evaluationScales.create`](#evaluationscalescreate) |
| `PATCH` | `/evaluation-scales/:id` | Actualizar escala | ADMIN |  | [`evaluationScales.update`](#evaluationscalesupdate) |
| `DELETE` | `/evaluation-scales/:id` | Eliminar escala (si nunca se usó) | ADMIN |  |  |

### Talleres

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/workshops` | Talleres | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE | `evaluatorId`, `status`, `search`, `includeDeleted` |  |
| `GET` | `/workshops/:id` | Taller | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `POST` | `/workshops` | Crear taller (nace `planned`) | ADMIN, TALLERISTA |  | [`workshops.create`](#workshopscreate) |
| `PATCH` | `/workshops/:id` | Editar (solo `planned`) o cambiar estado | ADMIN, TALLERISTA |  | [`workshops.update`](#workshopsupdate) |
| `DELETE` | `/workshops/:id` | Eliminar taller (sin asistencias) | ADMIN, TALLERISTA |  |  |
| `GET` | `/workshops/:id/skills` | Habilidades del taller | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `PUT` | `/workshops/:id/skills/:skillId` | Asociar habilidad (o restaurarla) | ADMIN, TALLERISTA |  |  |
| `DELETE` | `/workshops/:id/skills/:skillId` | Quitar habilidad (solo `planned`) | ADMIN, TALLERISTA |  |  |
| `GET` | `/workshops/:id/attendances` | Asistencias del taller | ADMIN, TALLERISTA |  |  |

### Sesiones

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/workshops/:id/sessions` | Sesiones del taller, en orden de inicio | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `POST` | `/workshops/:id/sessions` | Crear sesión (nace `planned`) | ADMIN, TALLERISTA |  | [`workshopSessions.create`](#workshopsessionscreate) |
| `GET` | `/sessions/:id` | Sesión (tema, objetivo, materiales, pasos, horario y estado) | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `PATCH` | `/sessions/:id` | Editar sesión (inicio solo en `planned`; contenido también en `in_progress`) | ADMIN, TALLERISTA |  | [`workshopSessions.update`](#workshopsessionsupdate) |
| `POST` | `/sessions/:id/start` | Iniciar sesión: abre la asistencia y la evaluación | ADMIN, TALLERISTA |  |  |
| `POST` | `/sessions/:id/finish` | Finalizar sesión: guarda el fin real y carga las calificaciones | ADMIN, TALLERISTA |  | [`workshopSessions.finish`](#workshopsessionsfinish) |
| `DELETE` | `/sessions/:id` | Eliminar sesión (solo `planned`) | ADMIN, TALLERISTA |  |  |
| `GET` | `/sessions/:id/attendances` | Asistencias de la sesión | ADMIN, TALLERISTA |  |  |

### Asistencias

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/students/:studentId/attendances` | Asistencias del estudiante | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `POST` | `/attendances` | Registrar asistencia a una sesión en curso | ADMIN, TALLERISTA |  | [`attendance.register`](#attendanceregister) |
| `GET` | `/attendances/:id` | Asistencia | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `PATCH` | `/attendances/:id` | Corregir la observación | ADMIN, TALLERISTA |  | [`attendance.update`](#attendanceupdate) |
| `DELETE` | `/attendances/:id` | Eliminar asistencia (con la sesión en curso) | ADMIN, TALLERISTA |  |  |

### Evaluaciones y calificaciones

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `GET` | `/students/:studentId/skills` | Calificaciones del estudiante (calculadas), con `skillName`, `categoryName` y su escala (`scale`: código, nombre y valor) | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `GET` | `/students/:studentId/category-averages` | Promedio por categoría del estudiante, con la escala en la que cae (`scale`) | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `POST` | `/evaluations` | Evaluar una habilidad en una asistencia (con la sesión en curso; cuenta al finalizarla) | ADMIN, TALLERISTA |  | [`evaluations.evaluate`](#evaluationsevaluate) |
| `GET` | `/attendances/:attendanceId/evaluations` | Evaluaciones de la asistencia | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `DELETE` | `/attendances/:attendanceId/evaluations/:workshopSkillId` | Eliminar evaluación (con la sesión en curso) | ADMIN, TALLERISTA |  |  |
| `POST` | `/students/:studentId/skills/:skillId/recalculate` | Recalcular a mano una calificación | ADMIN |  |  |

### Evidencias

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `POST` | `/evidences` | Subir evidencia | ADMIN, TALLERISTA |  | [`evidences.upload`](#evidencesupload) |
| `GET` | `/evidences/:id` | Evidencia | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `PATCH` | `/evidences/:id` | Actualizar evidencia | ADMIN, TALLERISTA |  | [`evidences.update`](#evidencesupdate) |
| `DELETE` | `/evidences/:id` | Eliminar evidencia (y sus relaciones) | ADMIN, TALLERISTA |  |  |
| `GET` | `/evidences/:id/students` | Estudiantes de la evidencia | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `PUT` | `/evidences/:id/students/:studentId` | Relacionar estudiante (o restaurarlo) | ADMIN, TALLERISTA |  |  |
| `DELETE` | `/evidences/:id/students/:studentId` | Quitar estudiante (no el último) | ADMIN, TALLERISTA |  |  |
| `GET` | `/students/:studentId/evidences` | Evidencias del estudiante | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |

### Credenciales

| Método | Ruta | Descripción | Roles | Consulta | Cuerpo |
|---|---|---|---|---|---|
| `POST` | `/credentials` | Registrar credencial (nace `pending`) | ADMIN, TALLERISTA |  | [`credentials.register`](#credentialsregister) |
| `GET` | `/credentials/:id` | Credencial | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |
| `PATCH` | `/credentials/:id` | Editar (solo `pending`) o cambiar estado | ADMIN, TALLERISTA |  | [`credentials.update`](#credentialsupdate) |
| `DELETE` | `/credentials/:id` | Eliminar credencial (solo `pending`) | ADMIN, TALLERISTA |  |  |
| `GET` | `/students/:studentId/credentials` | Credenciales del estudiante | ADMIN, TALLERISTA, ESTUDIANTE, ACUDIENTE |  |  |


---

## Cuerpos · feature `auth`

### auth.register

**Registrar usuario** · `POST /api/auth/register` · `app.auth.register(body)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `username` | string | **Sí** | 1–100, sin espacios |
| `email` | string | **Sí** | email válido, máx. 254 (se envía tal cual) |
| `password` | string | **Sí** | 1–128; no se transforma |
| `role` | string | **Sí** | código de rol (letras y `_`), se pasa a mayúsculas. El registro público admite `ACUDIENTE` \| `DONANTE` |

**Cuerpo válido:**

```json
{
  "username": "carlos.donante",
  "email": "carlos@prueba.com",
  "password": "ClaveDonante2026",
  "role": "DONANTE"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Falta la clave | `{ "username": "carlos.donante", "email": "carlos@prueba.com", "role": "DONANTE" }` | `password` |
| Email inválido y usuario con espacios | `{ "username": "carlos donante", "email": "carlos", "password": "x", "role": "DONANTE" }` | `email`, `username` |
| Rol con formato inválido | `{ "username": "carlos.donante", "email": "carlos@prueba.com", "password": "x", "role": "donante-1" }` | `role` |
| Campo del formato administrativo (clave) | `{ "username": "carlos.donante", "email": "carlos@prueba.com", "clave": "x", "role": "DONANTE" }` | `clave`, `password` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Las valida el **módulo administrativo** y su error se remite: datos rechazados (p. ej. rol fuera del catálogo) → 400 con `details` en nuestros nombres de campo; usuario o email ya registrado → 409
- Servicio caído o con respuesta inesperada → 502; sin respuesta a tiempo → 504; demasiados intentos → 429; sin `RENDER_API_URL` → 503

### auth.login

**Iniciar sesión** · `POST /api/auth/login` · `app.auth.login(body)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `email` | string | **Sí** | email válido, máx. 254 |
| `password` | string | **Sí** | 1–128 |

**Cuerpo válido:**

```json
{
  "email": "juan@prueba.com",
  "password": "ClaveDePrueba2026"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Faltan los dos campos | `{}` | `email`, `password` |
| Campo del formato administrativo (correo) | `{ "correo": "ana@prueba.com", "password": "x" }` | `correo`, `email` |
| Clave vacía | `{ "email": "ana@prueba.com", "password": "" }` | `password` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Credenciales incorrectas → 401 (mensaje del módulo administrativo)
- El módulo administrativo limita los intentos (hoy 20 cada 15 min por IP) → 429
- Servicio caído o sin token en la respuesta → 502; sin respuesta a tiempo → 504
- Respuesta: `{ token, tokenType, expiresIn, expiresAt, user: { id, username, email, roles }, saga }`. `user.id` y `user.roles` salen del token verificado (ADR-008)
- `saga` según el rol: `{ linked, professionalId, staffId, childId, guardianId, childIds }` (TALLERISTA: professionalId y staffId; ESTUDIANTE: childId; ACUDIENTE: guardianId y childIds de sus jóvenes vigentes). `linked: false` si la cuenta no está enlazada en Saga (registrarla con `/…/register` de Saga). `saga: null` si Saga no respondió: reintentar con `GET /auth/profile`. `GET /auth/profile` devuelve lo mismo, sin el token


---

## Cuerpos · feature `skills`

### skillCategories.create

**Crear categoría de habilidades** · `POST /api/skill-categories` · `app.skillCategories.create(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `name` | string | **Sí** | 2–100; se quitan espacios sobrantes |
| `description` | string \| null | No | máx. 500; vacía → null |

**Cuerpo válido:**

```json
{
  "name": "  Habilidades   blandas ",
  "description": "Relación con los demás"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Nombre de 1 carácter | `{ "name": "A" }` | `name` |
| Descripción de más de 500 | `{ "name": "Arte", "description": "xxx… (501 caracteres)" }` | `description` |
| Sin nombre | `{ "description": "algo" }` | `name` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Nombre único sin distinguir mayúsculas → 409

### skillCategories.update

**Actualizar categoría** · `PATCH /api/skill-categories/:id` · `app.skillCategories.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `(todos)` | — | No | `name` y `description` con las reglas de crear; opcionales |

**Cuerpo válido:**

```json
{
  "name": "Blandas"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Campo no permitido | `{ "status": "active" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La categoría debe existir → 404
- Nombre único → 409
- Se puede renombrar aunque tenga habilidades

### skills.create

**Crear habilidad** · `POST /api/skills` · `app.skills.create(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `name` | string | **Sí** | 2–100; se quitan espacios sobrantes |
| `skillCategoryId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12") |
| `status` | string | No | `active` \| `inactive` (por defecto `active`) |

**Cuerpo válido:**

```json
{
  "name": "Resolución de conflictos",
  "skillCategoryId": 1
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Categoría no numérica | `{ "name": "Arte", "skillCategoryId": "abc" }` | `skillCategoryId` |
| Categoría negativa | `{ "name": "Arte", "skillCategoryId": -1 }` | `skillCategoryId` |
| Estado inválido | `{ "name": "Arte", "skillCategoryId": 1, "status": "archived" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La categoría debe existir → 404
- Nombre único por categoría, sin distinguir mayúsculas → 409

### skills.update

**Actualizar habilidad** · `PATCH /api/skills/:id` · `app.skills.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `(todos)` | — | No | Los mismos de crear; opcionales |

**Cuerpo válido:**

```json
{
  "status": "inactive"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Nombre vacío | `{ "name": "   " }` | `name` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Nombre único en la categoría final → 409
- Se puede inactivar aunque esté en talleres en curso


---

## Cuerpos · feature `evaluations`

### evaluationScales.create

**Crear escala de evaluación** · `POST /api/evaluation-scales` · `app.evaluationScales.create(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `code` | string | **Sí** | 1–30; solo MAYÚSCULAS, números y `_` (no se convierte: se rechaza) |
| `name` | string | **Sí** | 2–100 |
| `description` | string \| null | No | máx. 500 |
| `numValue` | number | **Sí** | 0–5, máx. 2 decimales; valor de la calificación |
| `minValue` | number | **Sí** | 0–5, máx. 2 decimales |
| `maxValue` | number | **Sí** | 0–5, máx. 2 decimales |
| `isActive` | boolean | No | por defecto `true` |

**Cuerpo válido:**

```json
{
  "code": "EN_PROCESO",
  "name": "En proceso",
  "numValue": 3,
  "minValue": 2,
  "maxValue": 3.49
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Código en minúsculas | `{ "code": "en_proceso", "name": "En proceso", "numValue": 3, "minValue": 2, "maxValue": 3.49 }` | `code` |
| Valor mayor a 5 | `{ "code": "X", "name": "Equis", "numValue": 6, "minValue": 2, "maxValue": 3 }` | `numValue` |
| Más de 2 decimales | `{ "code": "X", "name": "Equis", "numValue": 2.555, "minValue": 2, "maxValue": 3 }` | `numValue` |
| Valor como texto | `{ "code": "X", "name": "Equis", "numValue": "3", "minValue": 2, "maxValue": 3 }` | `numValue` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- `minValue ≤ numValue ≤ maxValue` → 400
- `code` único y `name` único → 409
- Si está activa, su intervalo no puede solaparse con otra escala activa → 409

### evaluationScales.update

**Actualizar escala** · `PATCH /api/evaluation-scales/:id` · `app.evaluationScales.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `(todos)` | — | No | Los mismos de crear; opcionales |

**Cuerpo válido:**

```json
{
  "name": "En proceso de logro",
  "isActive": false
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Activo como texto | `{ "isActive": "si" }` | `isActive` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Si la escala ya se usó, no cambian `code`, `numValue`, `minValue` ni `maxValue` → 409
- Se valida el resultado final (valores nuevos + actuales)

### evaluations.evaluate

**Evaluar una habilidad en una asistencia** · `POST /api/evaluations` · `app.evaluations.evaluate(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `workshopAttendanceId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12") |
| `workshopSkillId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12") |
| `evaluationScaleId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12") |

**Cuerpo válido:**

```json
{
  "workshopAttendanceId": 10,
  "workshopSkillId": 3,
  "evaluationScaleId": 2
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Falta la escala | `{ "workshopAttendanceId": 10, "workshopSkillId": 3 }` | `evaluationScaleId` |
| Id inválido | `{ "workshopAttendanceId": "diez", "workshopSkillId": 3, "evaluationScaleId": 2 }` | `workshopAttendanceId` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La sesión de la asistencia debe estar `in_progress` y el taller `active` → 409
- El estudiante no debe haber salido de la fundación → 400
- La habilidad debe ser del mismo taller de la asistencia → 400
- La escala debe estar activa → 400
- Reevaluar cambia la escala. La calificación del joven se actualiza al finalizar la sesión, no al evaluar


---

## Cuerpos · feature `workshops`

### workshops.create

**Crear taller** · `POST /api/workshops` · `app.workshops.create(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `evaluatorId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12"); tallerista (professional_id) |
| `name` | string | **Sí** | 3–150 |
| `startsAt` | string \| null | No | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z") |
| `endsAt` | string \| null | No | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z") |
| `status` | string | No | solo `planned` (todo taller nace `planned`) |

**Cuerpo válido:**

```json
{
  "evaluatorId": 500,
  "name": "Música y ritmo",
  "startsAt": "2026-11-03T15:00:00Z"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Nombre de 2 caracteres | `{ "evaluatorId": 500, "name": "AB" }` | `name` |
| Crear con estado active | `{ "evaluatorId": 500, "name": "Música", "status": "active" }` | `status` |
| Fecha inválida | `{ "evaluatorId": 500, "name": "Música", "startsAt": "mañana" }` | `startsAt` |
| Varios errores | `{ "evaluatorId": "x", "name": "A" }` | `evaluatorId`, `name` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- El tallerista debe existir → 404
- `endsAt ≥ startsAt` → 400

### workshops.update

**Actualizar taller / cambiar estado** · `PATCH /api/workshops/:id` · `app.workshops.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `evaluatorId, name, startsAt, endsAt` | — | No | Las mismas reglas de crear |
| `status` | string | No | `planned` \| `active` \| `finished` \| `cancelled` |

**Cuerpo válido:**

```json
{
  "status": "finished",
  "endsAt": "2026-12-15T15:00:00Z"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Estado fuera del catálogo | `{ "status": "archived" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Transiciones: `planned → active → finished`; `planned`/`active → cancelled` → si no, 409
- Solo un taller `planned` se edita; en `active` solo cambia el estado (al finalizar puede llevar `endsAt`) → 409
- `active` exige `startsAt`, al menos una habilidad y al menos una sesión → 400
- `finished` exige `endsAt` y que todas sus sesiones estén finalizadas → 400/409
- Las fechas del taller no pueden dejar sesiones por fuera → 400

### workshopSessions.create

**Crear sesión de un taller** · `POST /api/workshops/:id/sessions` · `app.workshopSessions.create(workshopId, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `startsAt` | string | **Sí** | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z"); inicio tentativo. El fin no se envía: se da al finalizar la sesión |
| `topic` | string | **Sí** | tema; 2–150 |
| `objective` | string \| null | No | objetivo de la sesión; máx. 1000; vacío → null |
| `materials` | string \| null | No | materiales que deben llevar los jóvenes; máx. 1000; vacío → null |
| `steps` | string \| null | No | pasos o actividades; máx. 2000; vacío → null |

**Cuerpo válido:**

```json
{
  "startsAt": "2026-11-10T15:00:00Z",
  "topic": "Ritmos básicos con percusión",
  "objective": "Reconocer y seguir un pulso constante en grupo",
  "materials": "Ropa cómoda y una botella de agua",
  "steps": "1. Calentamiento. 2. Ejercicios de ritmo. 3. Cierre."
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Enviar el fin al crear (se da al finalizar) | `{ "startsAt": "2026-11-10T15:00:00Z", "endsAt": "2026-11-10T17:00:00Z", "topic": "Ritmos" }` | `endsAt` |
| Tema de 1 carácter | `{ "startsAt": "2026-11-10T15:00:00Z", "topic": "R" }` | `topic` |
| Crear con estado | `{ "startsAt": "2026-11-10T15:00:00Z", "topic": "Ritmos", "status": "in_progress" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Nace `planned` y sin fin (`endsAt: null`)
- El taller debe estar `planned` o `active` → 409
- El inicio cae dentro de las fechas del taller → 400
- No repite la hora de inicio de otra sesión ni cae dentro de una sesión ya dictada → 409

### workshopSessions.update

**Editar sesión** · `PATCH /api/sessions/:id` · `app.workshopSessions.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `startsAt, topic, objective, materials, steps` | — | No | Las mismas reglas de crear |

**Cuerpo válido:**

```json
{
  "materials": "Ropa cómoda, agua y un cuaderno"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Cambiar el estado | `{ "status": "finished" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- `planned`: se edita todo (el inicio es tentativo), sin chocar con otra sesión → 409
- `in_progress`: solo el contenido (tema, objetivo, materiales, pasos) → 409
- `finished`: no se edita → 409

### workshopSessions.finish

**Finalizar sesión** · `POST /api/sessions/:id/finish` · `app.workshopSessions.finish(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `endsAt` | string | No | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z"); fin real de la sesión (aquí se da el fin); por defecto, ahora |

**Cuerpo válido:**

```json
{}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Fecha inválida | `{ "endsAt": "ya" }` | `endsAt` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La sesión debe estar `in_progress` → 409
- Fin real posterior al inicio, no futuro y dentro del taller → 400
- Puede quedar encima del inicio de una sesión `planned`: esa deberá corregir su inicio antes de iniciarse
- Carga las evaluaciones de la sesión a las calificaciones de los jóvenes

### attendance.register

**Registrar asistencia** · `POST /api/attendances` · `app.attendance.register(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `sessionId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12"); la sesión define el taller y la fecha |
| `studentId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12"); joven (child_id) |
| `observation` | string \| null | No | máx. 1000; vacía → null |

**Cuerpo válido:**

```json
{
  "sessionId": 1,
  "studentId": 1,
  "observation": "Participó activamente"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Falta el estudiante | `{ "sessionId": 1 }` | `studentId` |
| Observación de más de 1000 | `{ "sessionId": 1, "studentId": 1, "observation": "aaa… (1001 caracteres)" }` | `observation` |
| Campo no permitido (ya no se envía el taller) | `{ "sessionId": 1, "studentId": 1, "workshopId": 2 }` | `workshopId` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La sesión debe estar `in_progress` y el taller `active` → 409
- El estudiante debe existir y no haber salido de la fundación → 404/400
- Una asistencia por estudiante y sesión → 409
- `attendedAt` es el inicio de la sesión

### attendance.update

**Actualizar asistencia** · `PATCH /api/attendances/:id` · `app.attendance.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `observation` | string \| null | No | máx. 1000; vacía → null |

**Cuerpo válido:**

```json
{
  "observation": "Llegó tarde"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Cambiar la fecha (ya no se permite) | `{ "attendedAt": "2026-10-20T15:00:00Z" }` | `attendedAt` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Solo se corrige la observación, también con la sesión finalizada
- Para cambiar de sesión se elimina y se registra en la otra


---

## Cuerpos · feature `evidences`

### evidences.upload

**Subir evidencia** · `POST /api/evidences` · `app.evidences.upload(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `url` | string | **Sí** | URL `https://…`, sin espacios, máx. 2048 |
| `title` | string | **Sí** | 2–150 |
| `type` | string | **Sí** | `IMAGE` \| `VIDEO` (el front previsualiza con `<img>` o `<video>`) |
| `studentIds` | array | **Sí** | 1–50 ids (número o texto con un entero > 0 (ej. 12 o "12")); los repetidos se cuentan una vez |

**Cuerpo válido:**

```json
{
  "url": "https://storage.fundacion.test/evidencias/mural.jpg",
  "title": "Mural colectivo",
  "type": "IMAGE",
  "studentIds": [
    1,
    "2"
  ]
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| URL http | `{ "url": "http://x.test/a.jpg", "title": "Foto", "type": "IMAGE", "studentIds": [ 1 ] }` | `url` |
| URL con espacios | `{ "url": "https://x.test/mi foto.jpg", "title": "Foto", "type": "IMAGE", "studentIds": [ 1 ] }` | `url` |
| Sin tipo | `{ "url": "https://x.test/a.jpg", "title": "Foto", "studentIds": [ 1 ] }` | `type` |
| Tipo no permitido | `{ "url": "https://x.test/a.pdf", "title": "Acta", "type": "PDF", "studentIds": [ 1 ] }` | `type` |
| Sin estudiantes | `{ "url": "https://x.test/a.jpg", "title": "Foto", "type": "IMAGE", "studentIds": [] }` | `studentIds` |
| Id de estudiante inválido | `{ "url": "https://x.test/a.jpg", "title": "Foto", "type": "IMAGE", "studentIds": [ 1, "x" ] }` | `studentIds.1` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Cada estudiante debe existir y estar activo → 404/400

### evidences.update

**Actualizar evidencia** · `PATCH /api/evidences/:id` · `app.evidences.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `url, title, type` | string | No | Las mismas reglas de subir. Los estudiantes se cambian con `linkStudent`/`unlinkStudent` |

**Cuerpo válido:**

```json
{
  "title": "Mural colectivo (versión final)",
  "type": "IMAGE"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Cambiar estudiantes aquí | `{ "studentIds": [ 1 ] }` | `studentIds` |
| Tipo en minúsculas | `{ "type": "video" }` | `type` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La evidencia debe existir → 404

### credentials.register

**Registrar credencial** · `POST /api/credentials` · `app.credentials.register(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `studentId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12") |
| `organizationName` | string | **Sí** | 2–150 |
| `url` | string | **Sí** | URL `https://…`, sin espacios, máx. 2048 |
| `workshopId` | number \| string \| null | No | número o texto con un entero > 0 (ej. 12 o "12") |
| `status` | string | No | solo `pending` (toda credencial nace `pending`) |

**Cuerpo válido:**

```json
{
  "studentId": 1,
  "organizationName": "Fundación Asisco",
  "url": "https://storage.fundacion.test/certificados/c-1.pdf",
  "workshopId": 1
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Sin URL | `{ "studentId": 1, "organizationName": "SENA" }` | `url` |
| Registrar como valid | `{ "studentId": 1, "organizationName": "SENA", "url": "https://x.test/c.pdf", "status": "valid" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- El estudiante debe existir → 404
- Si hay `workshopId`: taller `finished` y el estudiante con asistencia en él → 400

### credentials.update

**Actualizar credencial / cambiar estado** · `PATCH /api/credentials/:id` · `app.credentials.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `organizationName, url, workshopId` | — | No | Las mismas reglas de registrar |
| `status` | string | No | `pending` \| `valid` \| `revoked` |

**Cuerpo válido:**

```json
{
  "status": "valid"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Estado fuera del catálogo | `{ "status": "approved" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Transiciones: `pending → valid | revoked`, `valid → revoked` → 409
- Solo una credencial `pending` cambia sus datos → 409


---

## Cuerpos · feature `profiles`

### profiles.update

**Actualizar perfil** · `PATCH /api/profiles/:id` · `app.profiles.update(id, body, actor)`

> ⚠️ Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `firstNames` | string | No | 1–100 |
| `lastNames` | string \| null | No | 1–100 |
| `phone` | string \| null | No | 7–15 dígitos, `+` opcional |
| `documentType` | string \| null | No | `CC` \| `TI` \| `CE` \| `PA` \| `RC` \| `PPT` \| `NIT` |
| `documentNumber` | string \| null | No | 3–20 letras, números o `-` |
| `status` | string | No | `activo` \| `inactivo` \| `bloqueado` |
| `dataProcessingAcceptedAt` | string \| null | No | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z") |

**Cuerpo válido:**

```json
{
  "firstNames": "Ana María",
  "phone": "+573001112233",
  "dataProcessingAcceptedAt": "2026-10-27T15:00:00Z"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Teléfono y documento inválidos | `{ "phone": "abc", "documentType": "XX" }` | `phone`, `documentType` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- El perfil debe existir → 404
- `documentNumber` único → 409
- Los perfiles no se crean aquí: los crea el trigger al registrarse en Supabase Auth


---

## Cuerpos · feature `access`

### apps.create

**Crear aplicación** · `POST /api/apps` · `app.apps.create(body, actor)`

> ⚠️ Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `code` | string | **Sí** | 2–30 letras, números o `_` |
| `name` | string | **Sí** | 2–100 |

**Cuerpo válido:**

```json
{
  "code": "coordinador",
  "name": "Coordinación"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Código con espacios | `{ "code": "mal código", "name": "Malo" }` | `code` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Código único → 409

### roles.create

**Crear rol** · `POST /api/roles` · `app.roles.create(body, actor)`

> ⚠️ Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `code` | string | **Sí** | 2–30 letras, números o `_` |
| `name` | string | **Sí** | 2–100 |

**Cuerpo válido:**

```json
{
  "code": "coordinador",
  "name": "Coordinación"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Código con espacios | `{ "code": "mal código", "name": "Malo" }` | `code` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Código único → 409

### userRoles.assign

**Asignar rol a un usuario** · `POST /api/user-roles` · `app.userRoles.assign(body, actor)`

> ⚠️ Reglas según la PROPUESTA de VALIDACIONES.md §4, aún sin revisar.

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `userId` | string | **Sí** | UUID (formato 8-4-4-4-12) |
| `role` | string | **Sí** | código de rol (2–30 letras, números o `_`) |
| `app` | string \| null | No | código de aplicación; `null` = rol global |

**Cuerpo válido:**

```json
{
  "userId": "a1b2c3d4-0000-4000-8000-000000000001",
  "role": "tallerista",
  "app": "aula_up"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| userId no UUID | `{ "userId": "123", "role": "tallerista" }` | `userId` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- El perfil, el rol y la aplicación deben existir → 404
- No se repite el mismo rol con el mismo alcance → 409


---

## Uso en Postman

**Archivo:** `docs/api/postman-coleccion.json` (Postman v2.1). Trae las 88 rutas en 139 peticiones, **una carpeta por entidad**: Estado, Autenticación, Estudiantes, Acudientes, Talleristas, Personal (administrativos), Acceso (roles y aplicaciones), Perfiles, Categorías de habilidades, Habilidades, Escalas de evaluación, Talleres, Sesiones, Asistencias, Evaluaciones y calificaciones, Evidencias, Credenciales.

1. En Postman: *Import → File* y elige `docs/api/postman-coleccion.json`.
2. En la pestaña *Variables* de la colección llena:
   - `token`: el token del login (es el de Saga), **o**, solo fuera de producción,
   - `actorId` (id del usuario que queda en la auditoría) y `actorRoles` (p. ej. `ADMIN` o `TALLERISTA`); para probar "lo suyo", `actorProfessionalId`, `actorChildId` o `actorGuardianId`. Si hay `token`, se usa en lugar de ellos.
3. Arranca la API con `npm run dev`.
4. Ejecuta la colección completa (*Run collection*), una carpeta o cada petición.

**Orden dentro de cada carpeta:** crear (válido e inválidos) → consultar → actualizar → acciones (asociar, recalcular) → eliminar → restaurar.

**Pruebas de cada petición:**

| Petición | Espera |
|---|---|
| Consulta (GET) | 200, o 404 si el id no existe en esa BD |
| Cuerpo inválido | 400 con `code = VALIDATION` y exactamente los `details[].path` declarados |
| Cuerpo válido o acción | Pasa la forma; puede responder 2xx o un error de negocio (400 sin `details`, 404, 409) según los datos. Si crea, guarda el `id` en la variable de la entidad |

**Protección de datos:**

- Las escrituras sobre registros existentes (actualizar con cuerpo válido, asociar, eliminar, restaurar) **solo corren sobre lo que la colección creó** en esa sesión de Postman; si no, se omiten (`pm.execution.skipRequest`). El seed no se modifica.
- Los perfiles solo se modifican o eliminan si llenas `profileId` (nunca uses el propio: perderías el acceso).
- **Autenticación:** los casos inválidos se rechazan aquí (no llegan al módulo administrativo). `Iniciar sesión · válido` sí lo llama (cambia el cuerpo por credenciales reales); si responde 200, guarda el token en `authToken`, que usa `GET /auth/profile`. `Registrar usuario · válido` **crea un usuario real allá**: solo corre con `runExternalWrites = true`.
- Los casos válidos de **crear sí escriben** en la BD de `baseUrl`: úsala solo con la BD de pruebas. Al repetir la colección, varios responden 409 (ya existen): es esperado.

Las variables de ids traen valores de la BD de pruebas (`npm run db:seed:dev` y el simulado del módulo administrativo: estudiante `1`, acudiente `10`, tallerista `500`).

### Colección libre (pruebas a mano)

**Archivo:** `docs/api/postman-coleccion-libre.json`. Para el front y para probar flujos a mano: **una petición por ruta** (88), con un cuerpo válido de ejemplo y **sin protecciones ni pruebas**.

- Cada petición **se envía siempre**, con los ids que tengan las variables o los que escribas en la URL (p. ej. `/workshops/10/skills/1`).
- Crear y asociar guardan el id nuevo en su variable (`workshopId`, `skillId`, `workshopSkillId`, `sessionId`…), así que un flujo como crear taller → asociar habilidad → crear sesión → activar → iniciar sesión → registrar asistencia → evaluar → finalizar sesión funciona en orden.
- El login guarda el token en `authToken`, que usa `GET /auth/profile`.
- Se configura igual: `baseUrl` y `actorId` (o `token`).
- ⚠️ **Todo se ejecuta de verdad** sobre la BD de `baseUrl`: crear, actualizar y eliminar. Úsala solo con la BD de pruebas, y nunca pongas tu propio perfil en `profileId`.

`postman-casos.json` tiene los casos de cuerpo como **archivo de datos** (*Data file* del Collection Runner), con `method` y `path` de cada uno.
