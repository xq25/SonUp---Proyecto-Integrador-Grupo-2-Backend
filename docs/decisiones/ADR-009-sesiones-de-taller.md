# ADR-009 · Sesiones de taller: cada asistencia pertenece a una sesión

| | |
|---|---|
| **Estado** | Aceptada (2026-11-11). Implementada en `feat/sesiones-taller` |
| **Fecha** | 2026-11-11 |
| **Decidió** | Equipo del módulo |
| **Dependencias** | Ninguna de npm. En la BD, la extensión `btree_gist` (incluida en Supabase), para la restricción de no solapamiento |
| **Rama** | `feat/sesiones-taller` (rama de integración: las partes llegan por PR a ella y al final se hace un solo PR a `main`) |
| **BD** | Una BD de Supabase nueva y exclusiva para esta implementación (no se migran datos) |
| **Relacionado** | [VALIDACIONES.md §3.13](../VALIDACIONES.md) (reglas) · §3.5, §3.6, §3.8 y §3.9 · `docs/CONTEXTO_Y_ARQUITECTURA.md` §3.1 y §3.4 |

## 1. Contexto

- **Las sesiones solo existen implícitamente.** Un taller `active` recibe asistencias en días distintos, y la regla "una asistencia por joven, taller y día" (hora de Bogotá) es lo que permite varias sesiones.
- **Lo que no se puede hacer hoy:**
  - Saber qué sesiones tuvo un taller.
  - Programar una sesión futura con su horario.
  - Darle a cada sesión un **tema**, un **objetivo**, los **materiales** que deben llevar los jóvenes o los **pasos** de la actividad.
  - Tener dos sesiones el mismo día.
  - Distinguir un taller de **sesión única** de uno de **varias sesiones**.
- **Las calificaciones se mueven con cada evaluación,** aun a mitad de una clase. El equipo prefiere que se carguen cuando la sesión termina.

## 2. Decisión

### 2.1 Nueva tabla `workshop_sessions`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | bigint identity | PK |
| `workshop_id` | bigint, **FK `workshops`** (`restrict`) | Obligatoria: cada sesión pertenece a un único taller |
| `starts_at` | timestamptz | Obligatoria. Inicio **tentativo**, editable mientras la sesión esté `planned` |
| `ends_at` | timestamptz | **Fin real, se da al finalizar** (opcional hasta entonces; solo las sesiones `finished` lo tienen). `> starts_at`. Cambio del 2026-11-17 (§5) |
| `topic` | text | Obligatorio, 2–150, sin espacios sobrantes |
| `objective` | text | Opcional, máx. 1000 (agregado el 2026-11-16, migración `2026-11-16-sesiones-objetivo.sql`) |
| `materials` | text | Opcional, máx. 1000 |
| `steps` | text | Opcional, máx. 2000 |
| `status` | text | `planned` \| `in_progress` \| `finished`; por defecto `planned` |
| auditoría | — | `habilitar_auditoria('workshop_sessions', 'id')` |

- **Sin solapamiento** dentro de un taller:
  - El servicio lo valida entre todas las sesiones al crear y editar.
  - La BD lo garantiza entre las sesiones ya iniciadas o finalizadas:
    ```sql
    exclude using gist (workshop_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status <> 'planned' and eliminado_en is null)
    ```
  - Las `planned` quedan fuera de la restricción porque una sesión que termina tarde puede quedar encima del inicio tentativo de la siguiente (§2.2). Esa siguiente no puede iniciarse hasta corregirlo, y al iniciarse ya entra en la restricción.
  - Requiere `btree_gist`, instalada en el esquema `extensions`. El intervalo es semiabierto: terminar a las 3:00 y empezar otra a las 3:00 se permite.
- **Sesión única o varias:** se deduce del número de sesiones del taller. No hay un campo aparte que pueda contradecir los datos.
- `ends_at` es **obligatorio**: sin fin no se puede saber si dos sesiones se cruzan.

### 2.2 Ciclo de vida de la sesión

```
planned ──(iniciar)──▶ in_progress ──(finalizar)──▶ finished
```

| Paso | Requisitos | Efecto |
|---|---|---|
| **Crear / editar** (`planned`) | Taller `planned` o `active`; dentro de las fechas del taller; sin solaparse con otra sesión | Se puede cambiar todo, incluido el horario tentativo |
| **Iniciar** (`planned → in_progress`) | Taller `active`; `starts_at ≤ ahora`; ninguna otra sesión `in_progress` en el taller; **su inicio no se cruza con el fin de otra sesión** | Abre la asistencia y la evaluación. Si se cruza: *"cambia primero la fecha de inicio de esta sesión antes de tomar asistencia y calificar"* |
| **Finalizar** (`in_progress → finished`) | `ends_at` real (enviado o ahora), `> starts_at`, no futuro y sin pisar una sesión ya iniciada o finalizada | **Carga sus evaluaciones a las calificaciones de los jóvenes** (recalcula cada joven y habilidad evaluados en ella) |
| **Eliminar** | Solo `planned` | Borrado lógico |

**Por qué el inicio es tentativo:** una sesión puede durar más de lo previsto. Al finalizarla con su fin real, este puede quedar encima del inicio de la siguiente sesión `planned`. Eso se permite. La siguiente sesión no podrá iniciarse hasta que se corrija su inicio, y la BD rechaza el cambio si sigue cruzándose.

### 2.3 Asistencias, evaluaciones y calificaciones

- **Asistencia:**
  - `workshop_attendances.workshop_session_id` (FK, obligatoria). Entrada: `{ sessionId, studentId, observation? }`.
  - `workshop_id` se conserva (debe ser el de la sesión) para no reescribir las consultas por taller.
  - `attended_at` sale de la entrada y toma el `starts_at` de la sesión.
  - **Una asistencia por joven y sesión:** `unique (workshop_session_id, student_id) where eliminado_en is null`. Reemplaza el índice diario.
  - Se registra, corrige o elimina **solo con la sesión `in_progress`**. Con la sesión `finished`, solo se corrige la observación.
- **Evaluación:** se crea, cambia o elimina solo con la sesión de su asistencia `in_progress`.
- **Calificaciones:**
  - Solo cuentan las evaluaciones de **sesiones `finished`**, en orden de inicio de la sesión. La fórmula `(anterior + nueva) / 2` no cambia (CONTEXTO §3.4).
  - Recalculan: **finalizar una sesión** y el recálculo a mano.
  - Evaluar, reevaluar y eliminar evaluaciones o asistencias ya no recalculan, porque ocurren con la sesión en curso y todavía no cuentan.
  - Cambiar la fecha de una asistencia desaparece, porque la fecha la da la sesión.
- **Taller:**
  - Activar exige al menos una sesión, además de al menos una habilidad.
  - Finalizar exige que no quede ninguna sesión `planned` ni `in_progress`, y que `ends_at` del taller no sea anterior al fin de la última sesión.
  - Cancelar deja las sesiones como están: lo no finalizado no cuenta.

### 2.4 Código

Feature `workshops`, un archivo por entidad ([ADR-004](ADR-004-un-archivo-por-entidad.md)):

| Capa | Nuevo | Cambia |
|---|---|---|
| domain | `workshop-session.entity.ts`, `workshop-session.repository.ts`, `workshop-session.rules.ts` (estados, solapamiento) | `workshop-attendance.entity.ts` (`sessionId`), `attendance.rules.ts`, `evaluation-skill.rules.ts` |
| application | `workshop-sessions.service.ts` (crear, editar, iniciar, finalizar, eliminar), `workshop-session.schemas.ts` | `attendance.service.ts` y su esquema, `evaluations.service.ts` (sin recálculo), `workshops.service.ts` (activar, finalizar), `grading.service.ts` (`recalculateForSession`) |
| infrastructure | `prisma-workshop-session.repository.ts` | `prisma-workshop-attendance.repository.ts`, `prisma-evaluation-skill.repository.ts` (historial solo de sesiones `finished`, en orden de sesión) |
| http | `workshop-sessions.routes.ts` | `attendances.routes.ts`, `route-permissions.ts`, `AccessPolicy` |

### 2.5 Rutas

| Método | Ruta | Roles | Filtro |
|---|---|---|---|
| GET | `/workshops/:id/sessions` | A, T, E, Ac | T: su taller · E/Ac: taller disponible o al que asistieron |
| POST | `/workshops/:id/sessions` | A, T | T: su taller |
| GET | `/sessions/:id` | A, T, E, Ac | Igual que la lista |
| PATCH | `/sessions/:id` | A, T | T: su taller. Datos (en `planned`) o contenido (en `in_progress`) |
| POST | `/sessions/:id/start` | A, T | T: su taller |
| POST | `/sessions/:id/finish` | A, T | T: su taller. Cuerpo opcional `{ endsAt? }`. Carga las calificaciones |
| DELETE | `/sessions/:id` | A, T | T: su taller; solo `planned` |
| GET | `/sessions/:id/attendances` | A, T | T: su taller |

- **`POST /attendances`:** el cuerpo pasa a `{ sessionId, studentId, observation? }`. Las asistencias devuelven `sessionId`.
- **Iniciar y finalizar son acciones** (`POST …/start`, `POST …/finish`) y no un `PATCH` de `status`, porque tienen efectos: abren la asistencia y cargan las calificaciones.

### 2.6 Base de datos

- **No se migran datos.** Esta implementación usa una **BD de Supabase nueva y exclusiva** (`.env` local, `DATABASE_URL`/`DIRECT_URL`). Se prepara con el SQL principal ya actualizado y con el simulado administrativo, si se prueba sin Saga. Ambos se aplicaron el 2026-11-11 (16 tablas).
- **`database/asisco_login_supabase.sql`:** se actualiza con la tabla, los índices, `create extension if not exists btree_gist` y las políticas RLS de la tabla nueva.
- **Pendiente al integrar a `main`:** la BD de despliegue ya tiene talleres con asistencias. Antes del PR final hay que decidir si se crea de nuevo o si se escribe una migración de esquema (y qué hacer con esas asistencias).

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con sesiones implícitas y una ruta que agrupe asistencias por día | No permite programar sesiones ni guardar horario, tema, materiales o pasos |
| Campo `session_mode` (`single`/`multiple`) en el taller | Duplica lo que dice el número de sesiones y puede contradecirlo |
| `ends_at` opcional | Sin fin no se puede validar el solapamiento |
| Recalcular con cada evaluación (como hoy) | La calificación cambiaría a mitad de una sesión; el equipo quiere cargarla al terminarla |
| Iniciar y finalizar con `PATCH { status }` | Mezcla la edición de datos con acciones que tienen efectos (abrir asistencia, cargar calificaciones) |
| Validar el solapamiento solo en el servicio | Dos peticiones simultáneas podrían crear sesiones cruzadas; la exclusión en la BD lo impide |
| Conservar `attended_at` como hora real de llegada | Dos fechas por asistencia que pueden no coincidir; nadie la pide hoy |

## 4. Consecuencias

- **⚠️ Cambio incompatible para el front:**
  - Antes de tomar asistencia hay que crear e **iniciar** la sesión.
  - `POST /attendances` pide `sessionId` y ya no acepta `attendedAt` ni `workshopId`.
  - Las calificaciones del joven se ven actualizadas solo **al finalizar** la sesión.
  - El front y el backend deben desplegarse coordinados cuando `feat/sesiones-taller` llegue a `main`.
- **Observaciones (decisión del 2026-11-16):** quedan por joven y por sesión (`observation` de la asistencia). No se agrega una observación general del joven en el taller; el resumen del taller las muestra sesión por sesión.
- **Simplificaciones:** desaparecen el cambio de fecha de una asistencia y los recálculos al evaluar, reevaluar o eliminar.
- **Documentación y herramientas:** se actualizan CONTEXTO, README, `scripts/request-catalog.ts` (y `npm run docs:requests`) y el seed `db-seed-dev`, que crea sesiones, las inicia y las finaliza.

## 5. Cambio del 2026-11-17: el fin se da al finalizar

- **Motivo:** pedir un fin previsto al programar la sesión hacía el flujo confuso: el tallerista no sabe de antemano cuánto durará la clase.
- **Decisión:**
  - `ends_at` ya no se recibe al crear ni al editar. Se guarda solo al finalizar la sesión (`POST /sessions/:id/finish`, con `endsAt` opcional; por defecto, ahora).
  - Solo las sesiones `finished` tienen fin. Lo exige la BD con el check `workshop_sessions_ends_at_finished`.
- **Cruces, ahora que una sesión programada es solo un inicio:**
  - Dos sesiones de un taller no pueden empezar a la misma hora (índice único `workshop_sessions_start_key`).
  - Un inicio no puede caer dentro del horario real de una sesión finalizada.
  - No se inicia una sesión si ya se dictó una posterior.
  - La restricción de exclusión entre sesiones iniciadas se mantiene: una sesión en curso, sin fin, cuenta como abierta hacia adelante.
- **Migración:** `database/migraciones/2026-11-17-sesiones-fin-al-finalizar.sql` vuelve opcional la columna, quita el fin previsto de las sesiones no finalizadas y agrega el check y el índice.
- **Front:** el formulario de la sesión ya no pide hora de fin; la hora de fin real se pide (o se toma la actual) al pulsar "Finalizar sesión".
