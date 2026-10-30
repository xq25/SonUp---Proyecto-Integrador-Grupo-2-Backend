# API v1: rutas y cuerpos de petición

> **Generado** con `npm run docs:requests` desde `scripts/request-catalog.ts`. No editar a mano: cambia el catálogo y regenera.
> Cada ejemplo se validó contra los esquemas Zod reales (nivel 1, [ADR-001](../decisiones/ADR-001-zod-esquemas-de-entrada.md)) y cada ruta contra las registradas en Express ([ADR-002](../decisiones/ADR-002-capa-http-express.md)).
> Reglas completas por tabla: [VALIDACIONES.md](../VALIDACIONES.md). Colección de Postman: [postman-coleccion.json](postman-coleccion.json) (ver [Uso en Postman](#uso-en-postman)).

## Convenciones generales

| Tema | Regla |
|---|---|
| Base | `http://localhost:3000/api/v1` (`npm run dev`; puerto con `PORT`) |
| Autenticación | `Authorization: Bearer <access_token de Supabase>`. Solo fuera de producción: `X-Actor-Id: <uuid de un perfil>`. El perfil debe existir y estar `activo`. Públicas: `/health` y `/auth/register`, `/auth/login`, `/auth/profile` (remiten al módulo administrativo, [ADR-003](../decisiones/ADR-003-autenticacion-modulo-administrativo.md)) |
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
| Sin autenticación, token inválido o perfil inexistente | 401 | `UNAUTHORIZED` |
| Perfil `inactivo` o `bloqueado` | 403 | `FORBIDDEN` |
| No existe (registro o ruta) | 404 | `NOT_FOUND` |
| Conflicto (duplicado, estado que no lo permite) | 409 | `CONFLICT` |
| Demasiados intentos (lo informa el módulo administrativo) | 429 | `EXTERNAL_SERVICE` |
| Error inesperado | 500 | `INTERNAL` |
| Servicio externo caído o con respuesta inesperada | 502 | `EXTERNAL_SERVICE` |
| Servicio externo sin configurar (`RENDER_API_URL`) | 503 | `EXTERNAL_SERVICE` |
| Servicio externo sin respuesta a tiempo | 504 | `EXTERNAL_SERVICE` |

## Rutas por entidad

### Estado

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/health` | Estado del servicio (pública) |  |  |

### Autenticación

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `POST` | `/auth/register` | Registrar usuario (pública) |  | [`auth.register`](#authregister) |
| `POST` | `/auth/login` | Iniciar sesión (pública): devuelve el token |  | [`auth.login`](#authlogin) |
| `GET` | `/auth/profile` | Usuario dueño del token (`Authorization: Bearer <token del login>`) |  |  |

### Estudiantes

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/children` | Estudiantes | `statusId`, `search` |  |
| `GET` | `/children/by-document/:documentNumber` | Estudiante por número de documento |  |  |
| `GET` | `/children/:id` | Estudiante |  |  |
| `GET` | `/children/:id/guardians` | Acudientes del estudiante | `activeOnly` (por defecto `true`) |  |

### Acudientes

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/guardians` | Acudientes | `search` |  |
| `GET` | `/guardians/:id` | Acudiente |  |  |
| `GET` | `/guardians/:id/children` | Estudiantes del acudiente | `activeOnly` (por defecto `true`) |  |

### Talleristas

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/professionals` | Talleristas | `timeDonor` |  |
| `GET` | `/professionals/by-staff/:staffId` | Tallerista por `staff_id` |  |  |
| `GET` | `/professionals/:id` | Tallerista |  |  |

### Administrativos

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/administrators` | Administrativos | `status`, `search`, `includeDeleted` |  |
| `GET` | `/administrators/:id` | Administrativo |  |  |
| `POST` | `/administrators` | Crear administrativo |  | [`administrators.create`](#administratorscreate) |
| `PATCH` | `/administrators/:id` | Actualizar administrativo |  | [`administrators.update`](#administratorsupdate) |
| `DELETE` | `/administrators/:id` | Eliminar administrativo (lógico) |  |  |
| `POST` | `/administrators/:id/restore` | Restaurar administrativo |  |  |

### Acceso (roles y aplicaciones)

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/profiles/:userId/roles` | Roles del usuario | `app` |  |
| `GET` | `/profiles/:userId/roles/:role` | ¿Tiene el rol? → `{ hasRole }` | `app` |  |
| `GET` | `/apps` | Aplicaciones |  |  |
| `POST` | `/apps` | Crear aplicación |  | [`apps.create`](#appscreate) |
| `GET` | `/roles` | Roles |  |  |
| `POST` | `/roles` | Crear rol |  | [`roles.create`](#rolescreate) |
| `POST` | `/user-roles` | Asignar rol |  | [`userRoles.assign`](#userrolesassign) |
| `DELETE` | `/user-roles/:id` | Revocar rol |  |  |

### Perfiles

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/profiles` | Perfiles | `status`, `search`, `includeDeleted` |  |
| `GET` | `/profiles/me` | Perfil del usuario autenticado |  |  |
| `GET` | `/profiles/:id` | Perfil (UUID) |  |  |
| `PATCH` | `/profiles/:id` | Actualizar perfil |  | [`profiles.update`](#profilesupdate) |
| `DELETE` | `/profiles/:id` | Eliminar perfil (lógico) |  |  |
| `POST` | `/profiles/:id/restore` | Restaurar perfil |  |  |

### Categorías de habilidades

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/skill-categories` | Categorías |  |  |
| `GET` | `/skill-categories/:id` | Categoría |  |  |
| `POST` | `/skill-categories` | Crear categoría |  | [`skillCategories.create`](#skillcategoriescreate) |
| `PATCH` | `/skill-categories/:id` | Actualizar categoría |  | [`skillCategories.update`](#skillcategoriesupdate) |
| `DELETE` | `/skill-categories/:id` | Eliminar categoría (sin habilidades) |  |  |

### Habilidades

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/skills` | Habilidades | `skillCategoryId`, `status`, `search`, `includeDeleted` |  |
| `GET` | `/skills/:id` | Habilidad |  |  |
| `POST` | `/skills` | Crear habilidad |  | [`skills.create`](#skillscreate) |
| `PATCH` | `/skills/:id` | Actualizar habilidad |  | [`skills.update`](#skillsupdate) |
| `DELETE` | `/skills/:id` | Eliminar habilidad (sin historial) |  |  |

### Escalas de evaluación

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/evaluation-scales` | Escalas, ordenadas por `numValue` | `activeOnly` (por defecto `true`) |  |
| `GET` | `/evaluation-scales/coverage-gaps` | Tramos de 0–5 sin escala activa |  |  |
| `GET` | `/evaluation-scales/classify` | Escala en la que cae un valor | `value` (obligatorio) |  |
| `GET` | `/evaluation-scales/:id` | Escala |  |  |
| `POST` | `/evaluation-scales` | Crear escala |  | [`evaluationScales.create`](#evaluationscalescreate) |
| `PATCH` | `/evaluation-scales/:id` | Actualizar escala |  | [`evaluationScales.update`](#evaluationscalesupdate) |
| `DELETE` | `/evaluation-scales/:id` | Eliminar escala (si nunca se usó) |  |  |

### Talleres

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/workshops` | Talleres | `evaluatorId`, `status`, `search`, `includeDeleted` |  |
| `GET` | `/workshops/:id` | Taller |  |  |
| `POST` | `/workshops` | Crear taller (nace `planned`) |  | [`workshops.create`](#workshopscreate) |
| `PATCH` | `/workshops/:id` | Editar (solo `planned`) o cambiar estado |  | [`workshops.update`](#workshopsupdate) |
| `DELETE` | `/workshops/:id` | Eliminar taller (sin asistencias) |  |  |
| `GET` | `/workshops/:id/skills` | Habilidades del taller |  |  |
| `PUT` | `/workshops/:id/skills/:skillId` | Asociar habilidad (o restaurarla) |  |  |
| `DELETE` | `/workshops/:id/skills/:skillId` | Quitar habilidad (recalcula) |  |  |
| `GET` | `/workshops/:id/attendances` | Asistencias del taller |  |  |

### Asistencias

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/students/:studentId/attendances` | Asistencias del estudiante |  |  |
| `POST` | `/attendances` | Registrar asistencia |  | [`attendance.register`](#attendanceregister) |
| `GET` | `/attendances/:id` | Asistencia |  |  |
| `PATCH` | `/attendances/:id` | Actualizar asistencia |  | [`attendance.update`](#attendanceupdate) |
| `DELETE` | `/attendances/:id` | Eliminar asistencia (recalcula) |  |  |

### Evaluaciones y calificaciones

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `GET` | `/students/:studentId/skills` | Calificaciones del estudiante (calculadas) |  |  |
| `GET` | `/students/:studentId/category-averages` | Promedio por categoría del estudiante |  |  |
| `POST` | `/evaluations` | Evaluar una habilidad en una asistencia (recalcula la calificación) |  | [`evaluations.evaluate`](#evaluationsevaluate) |
| `GET` | `/attendances/:attendanceId/evaluations` | Evaluaciones de la asistencia |  |  |
| `DELETE` | `/attendances/:attendanceId/evaluations/:workshopSkillId` | Eliminar evaluación (recalcula) |  |  |
| `POST` | `/students/:studentId/skills/:skillId/recalculate` | Recalcular a mano una calificación |  |  |

### Evidencias

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `POST` | `/evidences` | Subir evidencia |  | [`evidences.upload`](#evidencesupload) |
| `GET` | `/evidences/:id` | Evidencia |  |  |
| `PATCH` | `/evidences/:id` | Actualizar evidencia |  | [`evidences.update`](#evidencesupdate) |
| `DELETE` | `/evidences/:id` | Eliminar evidencia (y sus relaciones) |  |  |
| `GET` | `/evidences/:id/students` | Estudiantes de la evidencia |  |  |
| `PUT` | `/evidences/:id/students/:studentId` | Relacionar estudiante (o restaurarlo) |  |  |
| `DELETE` | `/evidences/:id/students/:studentId` | Quitar estudiante (no el último) |  |  |
| `GET` | `/students/:studentId/evidences` | Evidencias del estudiante |  |  |

### Credenciales

| Método | Ruta | Descripción | Consulta | Cuerpo |
|---|---|---|---|---|
| `POST` | `/credentials` | Registrar credencial (nace `pending`) |  | [`credentials.register`](#credentialsregister) |
| `GET` | `/credentials/:id` | Credencial |  |  |
| `PATCH` | `/credentials/:id` | Editar (solo `pending`) o cambiar estado |  | [`credentials.update`](#credentialsupdate) |
| `DELETE` | `/credentials/:id` | Eliminar credencial (solo `pending`) |  |  |
| `GET` | `/students/:studentId/credentials` | Credenciales del estudiante |  |  |


---

## Cuerpos · feature `auth`

### auth.register

**Registrar usuario** · `POST /api/v1/auth/register` · `app.auth.register(body)`

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

**Iniciar sesión** · `POST /api/v1/auth/login` · `app.auth.login(body)`

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


---

## Cuerpos · feature `administrators`

### administrators.create

**Crear administrativo** · `POST /api/v1/administrators` · `app.administrators.create(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `fullName` | string | **Sí** | 3–150; solo letras (con tildes), espacios, `'` y `-`; se quitan espacios sobrantes |
| `documentType` | string | **Sí** | `CC` \| `TI` \| `CE` \| `PA` \| `RC` \| `PPT` \| `NIT` |
| `documentNumber` | string | **Sí** | 3–20 letras, números o `-`, sin espacios |
| `email` | string | **Sí** | email válido, máx. 254; se guarda en minúsculas |
| `phone` | string \| null | No | 7–15 dígitos, `+` opcional al inicio |
| `position` | string | **Sí** | 2–100 |
| `status` | string | No | `active` \| `inactive` (por defecto `active`) |

**Cuerpo válido:**

```json
{
  "fullName": "María José O'Neil-Pérez",
  "documentType": "CC",
  "documentNumber": "1020304050",
  "email": "Maria.Oneil@Fundacion.test",
  "phone": "+573001234567",
  "position": "Coordinadora"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Falta el email | `{ "fullName": "Ana Gil", "documentType": "CC", "documentNumber": "123", "position": "Aux" }` | `email` |
| Nombre con dígitos y documento con espacios | `{ "fullName": "Ana 2", "documentType": "CC", "documentNumber": "12 34", "email": "a@b.co", "position": "Aux" }` | `fullName`, `documentNumber` |
| Tipo de documento fuera del catálogo | `{ "fullName": "Ana Gil", "documentType": "DNI", "documentNumber": "123", "email": "a@b.co", "position": "Aux" }` | `documentType` |
| Teléfono inválido | `{ "fullName": "Ana Gil", "documentType": "CC", "documentNumber": "123", "email": "a@b.co", "position": "Aux", "phone": "12-34" }` | `phone` |
| Campo no permitido | `{ "fullName": "Ana Gil", "documentType": "CC", "documentNumber": "123", "email": "a@b.co", "position": "Aux", "role": "admin" }` | `role` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- `documentNumber` único → 409
- `email` único sin distinguir mayúsculas → 409

### administrators.update

**Actualizar administrativo** · `PATCH /api/v1/administrators/:id` · `app.administrators.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `(todos)` | — | No | Los mismos campos y reglas de crear; todos opcionales. Solo se cambian los enviados |

**Cuerpo válido:**

```json
{
  "position": "Directora",
  "status": "inactive"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Email inválido | `{ "email": "no-es-email" }` | `email` |
| Estado fuera del catálogo | `{ "status": "deleted" }` | `status` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- El administrativo debe existir → 404
- Documento y email únicos → 409


---

## Cuerpos · feature `skills`

### skillCategories.create

**Crear categoría de habilidades** · `POST /api/v1/skill-categories` · `app.skillCategories.create(body, actor)`

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

**Actualizar categoría** · `PATCH /api/v1/skill-categories/:id` · `app.skillCategories.update(id, body, actor)`

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

**Crear habilidad** · `POST /api/v1/skills` · `app.skills.create(body, actor)`

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

**Actualizar habilidad** · `PATCH /api/v1/skills/:id` · `app.skills.update(id, body, actor)`

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

**Crear escala de evaluación** · `POST /api/v1/evaluation-scales` · `app.evaluationScales.create(body, actor)`

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

**Actualizar escala** · `PATCH /api/v1/evaluation-scales/:id` · `app.evaluationScales.update(id, body, actor)`

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

**Evaluar una habilidad en una asistencia** · `POST /api/v1/evaluations` · `app.evaluations.evaluate(body, actor)`

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

- El taller debe estar `active` → 409
- El estudiante no debe haber salido de la fundación → 400
- La habilidad debe ser del mismo taller de la asistencia → 400
- La escala debe estar activa → 400
- Reevaluar cambia la escala y recalcula la calificación


---

## Cuerpos · feature `workshops`

### workshops.create

**Crear taller** · `POST /api/v1/workshops` · `app.workshops.create(body, actor)`

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

**Actualizar taller / cambiar estado** · `PATCH /api/v1/workshops/:id` · `app.workshops.update(id, body, actor)`

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
- `active` exige `startsAt` y al menos una habilidad → 400
- `finished` exige `endsAt`, no anterior a la última asistencia → 400

### attendance.register

**Registrar asistencia** · `POST /api/v1/attendances` · `app.attendance.register(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `studentId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12"); joven (child_id) |
| `workshopId` | number \| string | **Sí** | número o texto con un entero > 0 (ej. 12 o "12") |
| `attendedAt` | string | No | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z"); por defecto, ahora |
| `observation` | string \| null | No | máx. 1000; vacía → null |

**Cuerpo válido:**

```json
{
  "studentId": 1,
  "workshopId": 2,
  "attendedAt": "2026-10-20T15:00:00Z",
  "observation": "Participó activamente"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Falta el estudiante | `{ "workshopId": 2 }` | `studentId` |
| Observación de más de 1000 | `{ "studentId": 1, "workshopId": 2, "observation": "aaa… (1001 caracteres)" }` | `observation` |
| Campo no permitido | `{ "studentId": 1, "workshopId": 2, "grade": 5 }` | `grade` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- El taller debe estar `active` → 409
- El estudiante debe existir y no haber salido de la fundación → 404/400
- Fecha no futura y dentro de las fechas del taller → 400
- Una asistencia por estudiante, taller y día (hora de Bogotá) → 409

### attendance.update

**Actualizar asistencia** · `PATCH /api/v1/attendances/:id` · `app.attendance.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `attendedAt` | string | No | texto ISO 8601 con zona (ej. "2026-10-20T15:00:00Z") |
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
| Fecha inválida | `{ "attendedAt": "ayer" }` | `attendedAt` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Con el taller cerrado (`finished`/`cancelled`) solo se cambia la observación → 409
- Cambiar la fecha recalcula las calificaciones


---

## Cuerpos · feature `evidences`

### evidences.upload

**Subir evidencia** · `POST /api/v1/evidences` · `app.evidences.upload(body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `url` | string | **Sí** | URL `https://…`, sin espacios, máx. 2048 |
| `title` | string | **Sí** | 2–150 |
| `studentIds` | array | **Sí** | 1–50 ids (número o texto con un entero > 0 (ej. 12 o "12")); los repetidos se cuentan una vez |

**Cuerpo válido:**

```json
{
  "url": "https://storage.fundacion.test/evidencias/mural.jpg",
  "title": "Mural colectivo",
  "studentIds": [
    1,
    "2"
  ]
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| URL http | `{ "url": "http://x.test/a.jpg", "title": "Foto", "studentIds": [ 1 ] }` | `url` |
| URL con espacios | `{ "url": "https://x.test/mi foto.jpg", "title": "Foto", "studentIds": [ 1 ] }` | `url` |
| Sin estudiantes | `{ "url": "https://x.test/a.jpg", "title": "Foto", "studentIds": [] }` | `studentIds` |
| Id de estudiante inválido | `{ "url": "https://x.test/a.jpg", "title": "Foto", "studentIds": [ 1, "x" ] }` | `studentIds.1` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- Cada estudiante debe existir y estar activo → 404/400

### evidences.update

**Actualizar evidencia** · `PATCH /api/v1/evidences/:id` · `app.evidences.update(id, body, actor)`

| Campo | Tipo JSON | Requerido | Reglas |
|---|---|---|---|
| `url, title` | string | No | Las mismas reglas de subir. Los estudiantes se cambian con `linkStudent`/`unlinkStudent` |

**Cuerpo válido:**

```json
{
  "title": "Mural colectivo (versión final)"
}
```

**Casos inválidos (400, `VALIDATION`):**

| Caso | Cuerpo | Campos con error (`details[].path`) |
|---|---|---|
| Cambiar estudiantes aquí | `{ "studentIds": [ 1 ] }` | `studentIds` |

**Reglas de negocio** (las valida el servicio, no el esquema):

- La evidencia debe existir → 404

### credentials.register

**Registrar credencial** · `POST /api/v1/credentials` · `app.credentials.register(body, actor)`

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

**Actualizar credencial / cambiar estado** · `PATCH /api/v1/credentials/:id` · `app.credentials.update(id, body, actor)`

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

**Actualizar perfil** · `PATCH /api/v1/profiles/:id` · `app.profiles.update(id, body, actor)`

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

**Crear aplicación** · `POST /api/v1/apps` · `app.apps.create(body, actor)`

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

**Crear rol** · `POST /api/v1/roles` · `app.roles.create(body, actor)`

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

**Asignar rol a un usuario** · `POST /api/v1/user-roles` · `app.userRoles.assign(body, actor)`

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

**Archivo:** `docs/api/postman-coleccion.json` (Postman v2.1). Trae las 84 rutas en 134 peticiones, **una carpeta por entidad**: Estado, Autenticación, Estudiantes, Acudientes, Talleristas, Administrativos, Acceso (roles y aplicaciones), Perfiles, Categorías de habilidades, Habilidades, Escalas de evaluación, Talleres, Asistencias, Evaluaciones y calificaciones, Evidencias, Credenciales.

1. En Postman: *Import → File* y elige `docs/api/postman-coleccion.json`.
2. En la pestaña *Variables* de la colección llena:
   - `actorId`: UUID de un perfil activo (p. ej. el de `DB_CHECK_ACTOR`), **o**
   - `token`: `access_token` de una sesión de Supabase. Si hay `token`, se usa en lugar de `actorId`.
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

`postman-casos.json` tiene los casos de cuerpo como **archivo de datos** (*Data file* del Collection Runner), con `method` y `path` de cada uno.
