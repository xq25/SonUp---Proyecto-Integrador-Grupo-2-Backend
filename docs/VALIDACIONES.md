# Validaciones por tabla — PROPUESTA (en revisión)

> Documento de trabajo: se revisa tabla por tabla y se corrige. Cuando una tabla quede aprobada se marca **✅ Aprobada**.
> Las reglas ya implementadas en los servicios se marcan con ✔.

## 1. Dónde se valida cada cosa

| Nivel | Qué valida | Dónde |
|---|---|---|
| **1. Esquema de entrada** | Forma del dato: tipo, obligatorio, longitud, formato, rango, valores permitidos. Limpia el dato (`trim`, vacío → `null`, minúsculas en email/código) | Esquemas de validación por entidad, al entrar a los servicios (o en el controller, cuando exista) |
| **2. Reglas de negocio** | Lo que requiere consultar datos: existencia, unicidad, estados, coherencia entre registros | Servicios (`application`), lanzando `ValidationError` / `ConflictError` / `NotFoundError` |
| **3. Base de datos** | Última barrera: `not null`, `unique`, `check`, FK | SQL (`database/asisco_login_supabase.sql`) |

**Criterio acordado para la BD (nivel 3):** las reglas críticas se refuerzan en la BD como `not null` / `check`: obligatoriedad, longitudes, catálogos y patrones simples como el del número de documento. Los formatos complejos (email, teléfono) se validan solo en la entrada. Así nadie salta las reglas críticas escribiendo directo en Supabase.

Si una regla de la BD se viola desde el backend, `withPrismaErrors` la traduce a un error de dominio:

| Violación en la BD | Error de dominio |
|---|---|
| `check` (`23514`) o `not null` (`23502`) | `ValidationError` |
| `unique` (P2002) o exclusión (`23P01`) | `ConflictError` |
| FK (P2003) | `ValidationError` |

**Cuerpos de petición por operación** (campos, ejemplos válidos e inválidos y casos para Postman): [api/CUERPOS_DE_PETICION.md](api/CUERPOS_DE_PETICION.md).

**Librería de esquemas (nivel 1): Zod** — decisión y reglas de uso en [ADR-001](decisiones/ADR-001-zod-esquemas-de-entrada.md). Cada feature tiene sus esquemas en `src/<feature>/application/<entity>.schemas.ts`.

## 2. Reglas generales (aplican a todas las tablas)

| Tipo de campo | Regla propuesta |
|---|---|
| `id` y FK (`bigint`) | Entero positivo (`> 0`). Se recibe como `bigint` |
| Texto corto (nombres, títulos) | `trim`; sin saltos de línea; vacío → error si es obligatorio, `null` si es opcional |
| Texto largo (descripción, observación) | `trim`; vacío → `null`; máximo según tabla |
| URL | `http://` o `https://`; máximo 2048 caracteres |
| Email | Formato válido; minúsculas; máximo 254 |
| Teléfono | Solo dígitos, opcional `+` inicial; 7 a 15 dígitos (E.164) |
| Tipo de documento | Catálogo: `CC`, `TI`, `CE`, `PA`, `RC`, `PPT`, `NIT` |
| Número de documento | Letras, números y guion; 3 a 20 caracteres; sin espacios |
| Fechas (`timestamptz`) | ISO 8601 con zona horaria |
| `status` | Uno de los valores permitidos de la tabla |
| Columnas de auditoría (`creado_*`, `actualizado_*`, `eliminado_*`) | **Nunca** se aceptan desde la entrada: las pone `audit.*(actor)` y la BD |
| Campos desconocidos | Se rechazan (no se ignoran en silencio) |

---

## 3. Tablas del módulo

### 3.1 `administrators` (provisional) — ⛔ Retirada

> **Retirada el 2026-11-06** ([ADR-006](decisiones/ADR-006-administrativos-desde-saga.md)): los administrativos son personal (`staff`) del módulo administrativo y se leen en solo lectura. Estas reglas se conservan como historial; ya no se aplican.

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `full_name` | texto | **Sí** | 3–150 ✔(BD); letras, espacios, tildes, `'` y `-` | 1, 3 |
| `document_type` | texto | **Sí** | Catálogo `CC`, `TI`, `CE`, `PA`, `RC`, `PPT`, `NIT` ✔(BD) | 1, 3 |
| `document_number` | texto | **Sí** | `^[A-Za-z0-9-]{3,20}$` ✔(BD); único ✔ | 1, 2, 3 |
| `email` | texto | **Sí** | Formato email; se guarda en minúsculas ✔; único sin distinguir mayúsculas ✔; máx. 254 ✔(BD) | 1, 2, 3 |
| `phone` | texto | No | Formato teléfono (E.164) | 1 |
| `position` | texto | **Sí** | 2–100 ✔(BD) | 1, 3 |
| `status` | enum | No (def. `active`) | `active` \| `inactive` ✔(BD) | 1, 3 |

- **Implementado ✔:**
  - BD: `not null` y `check` en las columnas marcadas con ✔(BD).
  - Servicio: documento y email únicos (`ConflictError`); el email se normaliza con trim y minúsculas.
- **Pendiente para el nivel 1 (esquemas):** el formato de email y de teléfono, y el patrón de letras en `full_name`. Según lo acordado, se validan solo en la entrada, no en la BD.

### 3.2 `skill_categories` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `name` | texto | Sí | 2–100 ✔(BD). Sin espacios sobrantes: se normaliza ✔ y lo exige la BD ✔. **Único sin distinguir mayúsculas** ✔ (servicio + índice único sobre `lower(name)`) | 1, 2, 3 |
| `description` | texto | No | Máx. 500 ✔(BD); vacía → `null` ✔ | 1, 3 |

**Reglas de negocio:**

- No se elimina una categoría con habilidades vigentes ✔.
- Se **puede renombrar** aunque tenga habilidades calificadas, porque los promedios se agrupan por id ✔.

**Nota técnica:** el índice único sobre `lower(name)` solo existe en el SQL, porque Prisma no expresa índices sobre funciones. El repositorio busca con `mode: "insensitive"`.

### 3.3 `skills` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `name` | texto | Sí | 2–100 ✔(BD). Sin espacios sobrantes: se normaliza ✔ y lo exige la BD ✔. **Único por categoría, sin distinguir mayúsculas** ✔ (servicio + índice único sobre `(skill_category_id, lower(name))`) | 1, 2, 3 |
| `skill_category_id` | bigint | Sí | Debe existir y no estar eliminada ✔ | 1, 2, 3 |
| `status` | enum | No (def. `active`) | `active` \| `inactive` ✔(BD) | 1, 3 |

**Reglas de negocio:**

- **Nombre:** el mismo nombre puede existir en categorías distintas. Al cambiar el nombre o la categoría, se valida contra la categoría final ✔.
- **Cambiar de categoría:** se permite aunque tenga calificaciones. Los promedios por categoría se calculan al consultarlos ✔.
- **Inactivar:** se permite aunque esté en talleres en curso ✔.
  - Una habilidad `inactive` no se asocia a talleres nuevos ✔.
  - En los talleres donde ya está, se sigue evaluando ✔.
- **Eliminar:** solo si no tiene historial (evaluaciones o calificaciones vigentes). Si lo tiene → `ConflictError` y se debe inactivar ✔.

### 3.4 `evaluation_scales` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `code` | texto | Sí | **Solo mayúsculas** (`A-Z`), números y `_`, de 1 a 30 caracteres: `^[A-Z0-9_]{1,30}$` ✔(servicio + BD). No se normaliza: con minúsculas, espacios o símbolos (`-`, `.`, tildes…) se rechaza con `ValidationError` ✔. Único ✔ | 1, 2, 3 |
| `name` | texto | Sí | 2–100 ✔(BD); sin espacios sobrantes ✔; **único sin distinguir mayúsculas** ✔ (índice sobre `lower(name)`) | 1, 2, 3 |
| `description` | texto | No | Máx. 500 ✔(BD); vacía → `null` ✔ | 1, 3 |
| `num_value` | decimal(5,2) | Sí | **0–5** ✔(BD); entre `min_value` y `max_value` ✔(BD) | 1, 2, 3 |
| `min_value` | decimal(5,2) | Sí | **0–5** ✔(BD); `≤ max_value` ✔(BD) | 1, 2, 3 |
| `max_value` | decimal(5,2) | Sí | **0–5** ✔(BD); `≥ min_value` ✔(BD) | 1, 2, 3 |
| `is_active` | booleano | No (def. `true`) | — | 1 |

**Reglas de negocio:**

- **Rango global de calificación: 0–5** ✔ (servicio + BD; constantes `GRADE_MIN`/`GRADE_MAX`).
- **Vigente = activa y no eliminada.** Entre escalas vigentes:
  - Los intervalos no se solapan ✔. Lo hacen cumplir el servicio y la BD, con una restricción de exclusión `gist` sobre `numrange(min, max, '[]')`. Así un promedio cae en una sola escala.
  - `num_value` es único ✔. Está implícito en el no solapamiento, pero también hay un índice único parcial en la BD.
- **Se permiten huecos** entre escalas ✔.
  - `getCoverageGaps()` devuelve los tramos de 0–5 que no cubre ninguna escala.
  - Un promedio que cae en un hueco da `ValidationError`.
- **Redondeo:** los promedios se redondean a 2 decimales antes de clasificarse ✔. Así `(1 + 2.99) / 2 = 1.995` pasa a 2.00 y no cae entre 1.99 y 2.00.
- **Escala en uso** (con evaluaciones o calificaciones vigentes) ✔:
  - Solo se pueden cambiar nombre, descripción y `is_active`.
  - `code`, `num_value`, `min_value` y `max_value` quedan fijos → `ConflictError`. Así las calificaciones históricas no cambian.
  - No se puede eliminar → `ConflictError`; se inactiva.
- **Al actualizar,** se valida el resultado final, es decir, los valores nuevos combinados con los actuales ✔.
- **Una escala inactiva** no se usa en nuevas evaluaciones ✔.

### 3.5 `student_skills` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `student_id` | bigint | Sí | Debe existir en `children` ✔ | 2 |
| `skill_id` | bigint | Sí | Debe existir ✔ | 2, 3 |
| `evaluation_scale_id` | bigint | Sí | **Calculado**, no se recibe en la entrada ✔. Siempre es una escala activa ✔ | 2, 3 |

**Reglas de negocio:**

- **Sin entrada directa:** la tabla la calcula `GradingService` al **finalizar una sesión** (con las evaluaciones de esa sesión) y en el recálculo a mano. Solo cuentan las evaluaciones de sesiones `finished`, en orden de inicio de la sesión (ADR-009). El cálculo es `(anterior + nueva) / 2`, redondeado y clasificado en una escala ✔. Detalle en `CONTEXTO_Y_ARQUITECTURA.md` §3.4.
- **Una fila por estudiante y habilidad;** recalcular actualiza esa misma fila ✔.
- **Promedio en un hueco** entre escalas → `ValidationError` ✔.
- **Estudiante activo:** para registrar asistencia o evaluaciones, el estudiante no debe haber salido de la fundación. Es decir, `children.exit_date` debe estar vacía o no ser anterior a hoy ✔.
  - "Hoy" se calcula en `America/Bogota`.
  - El día de salida todavía cuenta como activo.
  - No se usa `status_id` porque su catálogo aún no lo comparte el módulo administrativo.
  - Las calificaciones de quien ya salió se conservan y se pueden consultar.
- **Habilidades inactivas:** siguen contando en `StudentSkillsService.listByStudent` y en los promedios por categoría ✔. Inactivar solo impide usarlas en talleres nuevos.

### 3.6 `workshops` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `evaluator_id` | bigint | Sí | Debe existir en `professionals` ✔ | 2 |
| `name` | texto | Sí | 3–150 ✔(BD); sin espacios sobrantes (se normaliza ✔ y lo exige la BD ✔) | 1, 3 |
| `starts_at` | timestamptz | Para `active` y `finished` | Obligatorio para activar ✔(servicio + BD) | 1, 2, 3 |
| `ends_at` | timestamptz | Para `finished` | `≥ starts_at` ✔(BD); obligatorio para finalizar ✔(servicio + BD) | 1, 2, 3 |
| `status` | enum | No (def. `planned`) | `planned` \| `active` \| `finished` \| `cancelled` ✔(BD) | 1, 2, 3 |

**Transiciones de estado** ✔ (`workshop.rules.ts`):

```
planned ──▶ active ──▶ finished
   │           │
   └─────┬─────┘
         ▼
     cancelled        (finished y cancelled son finales)
```

- **Al crear:** todo taller nace **`planned`** ✔. Pedir otro estado da `ValidationError`, aunque venga con `starts_at`. Para activarlo se usa `update`.
- **Saltos y retrocesos:** no se puede saltar estados (`planned → finished`) ni retroceder o reabrir (`finished → active`, `cancelled → planned`) → `ConflictError` ✔.

**Edición** ✔:

- **`planned`:** se edita todo (nombre, fechas, tallerista) y se puede activar en el mismo cambio.
- **`active`:** solo cambia de estado. Al pasar a `finished` se puede enviar `ends_at` en el mismo cambio. Otras ediciones → `ConflictError`. Enviar los mismos valores que ya tiene no cuenta como edición.
- **`finished` / `cancelled`:** no se editan.
- **Validación del resultado final:** se valida combinando los valores nuevos con los actuales.

**Sesiones** ✔ (§3.13, ADR-009):

- **Para activar** (`planned → active`) hacen falta al menos una habilidad (§3.7) y **al menos una sesión** → `ValidationError`.
- **Para finalizar** (`active → finished`) todas sus sesiones deben estar `finished` → `ConflictError`.
- **Sus fechas** (`starts_at`, `ends_at`) no pueden dejar sesiones por fuera → `ValidationError`. Por eso `ends_at` nunca queda antes del fin de su última sesión.
- **Al cancelar** las sesiones quedan como están; las evaluaciones de sesiones no finalizadas no cuentan.

**Eliminar:** solo si el taller no tiene asistencias vigentes. Si las tiene → `ConflictError`; se cancela ✔.

**Nota:** las transiciones las valida el servicio. La BD exige las fechas de cada estado, pero no el orden de las transiciones; para eso haría falta un trigger.

### 3.7 `workshop_skills` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `workshop_id` | bigint | Sí | Debe existir y estar **`planned`** ✔ | 2, 3 |
| `skill_id` | bigint | Sí | Debe existir y estar `active` ✔ | 2, 3 |

**Reglas de negocio:**

- **Único por taller y habilidad** ✔. Volver a asociar una habilidad restaura la misma fila ✔. No recalcula: con el taller `planned` aún no hay sesiones iniciadas ni evaluaciones.
- **Solo con el taller `planned`** se agregan o quitan habilidades ✔. En `active`, `finished` o `cancelled` → `ConflictError`. Es coherente con la regla de que solo `planned` se edita (§3.6).
- **Con evaluaciones vigentes,** la habilidad no se quita del taller → `ConflictError` ✔. "Vigente" significa que ni la evaluación ni su asistencia están eliminadas. Es una protección: como las habilidades solo cambian en `planned` y las evaluaciones exigen una sesión en curso (taller `active`), en el flujo normal no ocurre.
- **Para activar un taller** (`planned → active`) se necesita al menos una habilidad → si no, `ValidationError` ✔.

### 3.8 `workshop_attendances` — ✅ Aprobada

Asistencia de un joven a una **sesión** del taller (ADR-009, 2026-11-11). Reemplaza el modelo anterior de "una asistencia por joven, taller y día".

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `workshop_session_id` | bigint (FK `workshop_sessions`) | Sí (entrada `sessionId`) | Debe existir y estar **`in_progress`**, con el taller `active` ✔ | 1, 2, 3 |
| `student_id` | bigint | Sí | Debe existir en `children` y estar activo (sin `exit_date` pasada, §3.5) ✔ | 1, 2 |
| `workshop_id` | bigint | Sí (no se recibe) | El de la sesión: lo pone el servicio ✔ | 2, 3 |
| `attended_at` | timestamptz | Sí (no se recibe) | El `starts_at` de la sesión: lo pone el servicio ✔ | 2 |
| `observation` | texto | No | Máx. 1000 ✔(BD); sin espacios sobrantes y vacía → `null` ✔ | 1, 3 |

**Reglas de negocio:**

- **Solo con la sesión `in_progress`** (y el taller `active`) se registra o elimina una asistencia ✔. Con la sesión `planned` → `ConflictError` ("iníciala para tomar asistencia"); con la sesión `finished` → `ConflictError`.
- **Una asistencia por estudiante y sesión** ✔ (servicio + índice único parcial `(workshop_session_id, student_id)` entre las vigentes). Un taller puede tener varias sesiones, incluso el mismo día.
- **Editar:** solo se corrige la observación, también con la sesión finalizada ✔. La fecha no cambia; para pasar una asistencia a otra sesión se elimina (con la sesión en curso) y se registra en la otra.
- **No recalcula calificaciones:** las evaluaciones de la asistencia cuentan cuando la sesión se finaliza (§3.5, §3.13).
- **La observación es por joven y por sesión** (decisión del 2026-11-16). No hay una observación general del joven en el taller: el resumen del taller muestra las observaciones de cada sesión, y se corrigen con \`PATCH /attendances/:id\`.

### 3.9 `evaluation_skills` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `workshop_attendance_id` | bigint | Sí | Debe existir; su **sesión debe estar `in_progress`** y su taller `active` ✔; el estudiante debe estar activo (§3.5) ✔ | 2, 3 |
| `workshop_skill_id` | bigint | Sí | Debe existir y ser del mismo taller de la asistencia ✔ | 2, 3 |
| `evaluation_scale_id` | bigint | Sí | Debe existir y estar activa ✔ | 2, 3 |

**Reglas de negocio:**

- **Única por asistencia y habilidad;** reevaluar cambia la escala ✔.
- **Solo con la sesión de la asistencia `in_progress`** se crea, cambia o elimina una evaluación ✔. Con la sesión `planned` o `finished` → `ConflictError`; las de una sesión finalizada son historial.
- **No recalcula al evaluar:** la calificación del estudiante se actualiza al **finalizar la sesión** (§3.5, §3.13).
- **Quién evalúa:** solo el tallerista del taller (o `ADMIN`). Lo aplica `AccessPolicy` con el enlace de la cuenta con su `professional_id` en Saga ([ADR-008](decisiones/ADR-008-seguridad-por-roles.md)) ✔.

### 3.10 `evidences` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `url` | texto | Sí | **Cualquier `https`**, sin espacios, formato de URL válido; máx. 2048 ✔(servicio + BD) | 1, 3 |
| `title` | texto | **Sí** | 2–150 ✔(BD); sin espacios sobrantes ✔ | 1, 3 |
| `type` | enum | **Sí** | `IMAGE` \| `VIDEO` ✔(BD). El front lo usa para previsualizar con `<img>` o `<video>` (pedido del equipo de front, 2026-11-09). Se puede cambiar al editar | 1, 3 |
| `studentIds` (entrada) | lista de bigint | **Sí** | **1 a 50** estudiantes ✔; repetidos se cuentan una vez ✔; cada uno debe existir ✔ y estar **activo** (§3.5) ✔ | 1, 2 |

**Reglas de negocio:**

- **Al subir,** la evidencia y sus estudiantes se guardan en una sola operación ✔. Quién la subió queda en `created_by` ✔.
- **Al relacionar** (subir o `linkStudent`), el estudiante debe estar activo ✔. Las evidencias de quien ya salió se conservan.
- **Límite de estudiantes:** máximo 50 por evidencia ✔ (`linkStudent` → `ConflictError` si se supera). **No se quita el último estudiante** → `ConflictError`; se elimina la evidencia ✔.
- **Al eliminar la evidencia** también se ocultan sus relaciones con estudiantes ✔.
- Validación de URL reutilizable: `httpsUrlSchema` en `shared/application/schemas.ts`.
- **No se valida que la URL coincida con `type`** (por ejemplo, `.mp4` con `VIDEO`): la URL puede no tener extensión. Lo declara quien sube la evidencia.
- **Pendiente:** el tamaño máximo y el formato real del archivo se validan al subirlo, no en la URL. Se definen con la capa de almacenamiento.

### 3.11 `student_evidences` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `student_id` | bigint | Sí | Debe existir en `children` ✔ y estar activo al relacionarlo (§3.5) ✔ | 2 |
| `evidence_id` | bigint | Sí | Debe existir y no estar eliminada ✔ | 2, 3 |

**Reglas de negocio** (complementan §3.10):

- **Única por estudiante y evidencia** ✔. Volver a relacionar restaura la misma fila ✔.
- **De 1 a 50 estudiantes por evidencia;** no se quita el último ✔.
- **Al eliminar la evidencia** se ocultan sus relaciones ✔.
- **`listByStudent`** devuelve las evidencias vigentes del estudiante, de la más reciente a la más antigua, aunque el estudiante ya haya salido de la fundación ✔.

### 3.12 `credentials` — ✅ Aprobada

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `student_id` | bigint | Sí | Debe existir en `children` ✔. **No** se exige que esté activo: la credencial puede registrarse después de su salida | 2 |
| `organization_name` | texto | **Sí** | 2–150 ✔(BD); sin espacios sobrantes ✔ | 1, 3 |
| `workshop_id` | bigint | No | Si viene: el taller debe existir, estar **`finished`** y el estudiante debe tener **al menos una asistencia** en él ✔ | 2, 3 |
| `url` | texto | **Sí** | `https` válida, sin espacios, máx. 2048 ✔(servicio + BD) | 1, 3 |
| `status` | enum | No (def. `pending`) | `pending` \| `valid` \| `revoked` ✔(BD) | 1, 2, 3 |

**Transiciones de estado** ✔ (`credential.rules.ts`):

```
pending ──▶ valid ──▶ revoked
   └──────────────────▲          (revoked es final)
```

- **Al registrar:** toda credencial nace **`pending`** ✔. Pedir otro estado da `ValidationError`.
- **Retrocesos:** no se puede volver atrás (`valid → pending`) ni reactivar una revocada → `ConflictError` ✔.

**Edición y borrado** ✔:

- **`pending`:** se editan los datos y se puede eliminar.
- **`valid` y `revoked`:** solo cambian de estado (`valid → revoked`). Editar datos o eliminar → `ConflictError`.

### 3.13 `workshop_sessions` — ✅ Aprobada ([ADR-009](decisiones/ADR-009-sesiones-de-taller.md), 2026-11-11)

Sesiones de un taller: cada clase o encuentro, con su horario y su contenido. Un taller tiene **una o más sesiones** y cada sesión pertenece a un único taller (FK `workshop_id`). "Sesión única" es un taller con una sola sesión. Cada asistencia pertenece a una sesión (cambios en §3.8).

| Campo | Tipo | Requerido | Regla | Nivel |
|---|---|---|---|---|
| `workshop_id` | bigint (FK `workshops`) | Sí | Debe existir y estar `planned` o `active` para crear o editar sesiones | 2, 3 |
| `starts_at` | timestamptz | Sí | Inicio **tentativo**: se puede corregir mientras la sesión esté `planned`. Dentro de `starts_at`–`ends_at` del taller, si están definidas | 1, 2, 3 |
| `ends_at` | timestamptz | Sí | Fin previsto; al finalizar la sesión se guarda el fin real. `> starts_at` (BD) | 1, 2, 3 |
| `topic` | texto | **Sí** | Tema de la sesión. 2–150 (BD); sin espacios sobrantes | 1, 3 |
| `objective` | texto | No | Objetivo de la sesión. Máx. 1000 (BD); vacío → `null` (agregado el 2026-11-16) | 1, 3 |
| `materials` | texto | No | Materiales o implementos que deben llevar los jóvenes. Máx. 1000 (BD); vacío → `null` | 1, 3 |
| `steps` | texto | No | Pasos o actividades de la sesión. Máx. 2000 (BD); vacío → `null` | 1, 3 |
| `status` | enum | No (def. `planned`) | `planned` \| `in_progress` \| `finished` (BD) | 1, 2, 3 |

**Ciclo de vida:**

```
planned ──(iniciar)──▶ in_progress ──(finalizar)──▶ finished
 editable              asistencia y evaluación        historial: sus evaluaciones
                       abiertas                       se cargan a las calificaciones
```

- **`planned`** (programada): nace así. Se editan todos sus datos, incluido el horario tentativo, y se puede eliminar.
- **`in_progress`** (en curso): se toma asistencia y se evalúa. Solo se corrige el contenido (`topic`, `objective`, `materials`, `steps`); el horario ya no cambia.
- **`finished`** (finalizada): es historial, no se edita ni se elimina, no se reabre.

**Horario y solapamiento:**

- **Dos sesiones de un mismo taller no se solapan.** Sus intervalos `[starts_at, ends_at)` no pueden cruzarse; terminar a las 3:00 y empezar otra a las 3:00 sí se permite. Se valida al crear, al editar y al finalizar. Lo valida el servicio y, entre sesiones ya iniciadas o finalizadas, también la BD (restricción de exclusión `workshop_sessions_no_overlap`) → `ConflictError`. Entre sesiones `planned` solo lo valida el servicio, porque su horario es tentativo (ver "Finalizar").
- Se permiten **varias sesiones el mismo día**, siempre que no se solapen.

**Iniciar una sesión** (`planned → in_progress`), es decir, abrir la asistencia y la evaluación:

- El taller debe estar `active`.
- La hora de inicio ya debe haber llegado (`starts_at ≤ ahora`).
- **No puede haber otra sesión `in_progress`** en el mismo taller.
- **Si su inicio se solapa con el fin de otra sesión** (por ejemplo, porque la anterior duró más de lo previsto y se finalizó más tarde) → `ConflictError`: *"La sesión se cruza con la sesión «…», que termina a las …: cambia primero la fecha de inicio de esta sesión antes de tomar asistencia y calificar"*.

**Finalizar una sesión** (`in_progress → finished`):

- `ends_at` se actualiza con el fin real: el enviado o, si no se envía, ahora. Debe ser `> starts_at` y no puede ser futuro.
- **Puede terminar más tarde de lo previsto** y quedar encima del inicio tentativo de una sesión `planned` siguiente. Se permite, y esa siguiente sesión tendrá que corregir su inicio antes de iniciarse (regla de arriba). No puede quedar encima de una sesión ya iniciada o finalizada → `ConflictError`.
- **Al finalizar, sus evaluaciones se cargan a las calificaciones de los jóvenes:** se recalcula la calificación de cada (joven, habilidad) evaluado en la sesión (§3.5).

**Eliminar:** solo en `planned` (todavía no tiene asistencias) → si no, `ConflictError`.

**Orden:** se listan por `starts_at`. El número de sesión ("Sesión 2 de 5") lo calcula quien consulta; no se guarda.

**Cambios en otras tablas:**

- **`workshops` (§3.6):**
  - Para **activar** (`planned → active`) hacen falta, además de al menos una habilidad, **al menos una sesión** → `ValidationError`.
  - Para **finalizar** (`active → finished`) no puede quedar ninguna sesión `planned` ni `in_progress`: se finalizan o se eliminan primero → `ConflictError`. `ends_at` del taller no puede ser anterior al fin de su última sesión.
  - Las fechas del taller siguen siendo manuales y las sesiones deben caer dentro de ellas. Si se editan en `planned`, no pueden dejar sesiones por fuera → `ValidationError`.
  - **Cancelar** un taller deja sus sesiones como están. Las evaluaciones de una sesión que no se finalizó no cuentan en las calificaciones.
- **`workshop_attendances` (§3.8):**
  - Se agrega `workshop_session_id` (FK, obligatorio). Entrada: `{ sessionId, studentId, observation? }`. `workshop_id` se conserva y debe ser el de la sesión.
  - **Solo en sesiones `in_progress`** se registra, corrige o elimina una asistencia. Con la sesión `finished` solo se corrige la observación.
  - `attended_at` sale de la entrada: es el `starts_at` de la sesión.
  - **Una asistencia por joven y sesión** (índice único parcial entre las vigentes). Reemplaza "una por joven, taller y día".
  - El joven debe estar activo (§3.5). No se cambia una asistencia de sesión: se elimina y se registra en la otra.
- **`evaluation_skills` (§3.9):** solo se crean, cambian o eliminan con la sesión de su asistencia `in_progress`. Con la sesión `finished` son historial.
- **Calificaciones (§3.5):**
  - **Solo cuentan las evaluaciones de sesiones `finished`.** Se ordenan por el inicio de la sesión. La fórmula no cambia.
  - Evaluar durante la sesión no mueve la calificación del joven; **se carga al finalizar la sesión**.
  - Por eso ya no recalculan evaluar, reevaluar ni eliminar evaluaciones o asistencias: lo hacen **finalizar una sesión** y el recálculo a mano.

## 4. Tablas de acceso (heredadas del script de login) — ⚠️ propuesta aplicada, sin revisar

Solo los campos que este módulo modifica:

| Tabla | Campo | Regla propuesta |
|---|---|---|
| `perfiles` | `nombres` | 1–100 |
| `perfiles` | `apellidos` | Máx. 100 |
| `perfiles` | `celular` | Formato teléfono |
| `perfiles` | `tipo_documento` / `numero_documento` | Catálogo / formato de documento; único ✔ |
| `perfiles` | `estado` | `activo` \| `inactivo` \| `bloqueado` (check en BD) |
| `roles` / `aplicaciones` | `codigo` | 2–30; `^[a-zA-Z0-9_]+$`; único ✔ |

Las tablas del módulo administrativo **no se validan aquí**: solo se leen. Solo se validan los parámetros de consulta (ids positivos, texto de búsqueda de máx. 100).

## 5. Decisiones

1. **Librería de esquemas:** ✅ **Zod** ([ADR-001](decisiones/ADR-001-zod-esquemas-de-entrada.md)).
2. **Dónde viven los esquemas:** ✅ `src/<feature>/application/<entity>.schemas.ts`, y los reutilizables en `src/shared/application/schemas.ts`. Los usan los servicios al recibir la entrada.
3. **Migración a esquemas Zod (nivel 1):** ✅ completa en todas las features (ADR-001 §7 y §8). Todos los validadores manuales de forma se retiraron.
   - **Pendiente:** revisar tabla por tabla la propuesta de §4 (`perfiles`, `roles`, `aplicaciones`), que hoy aplican los esquemas de `profiles` y `access`.
4. **Errores de validación de entrada:** `ValidationError` trae `details` con un elemento `{ path, message }` por campo inválido, con mensajes en español.
