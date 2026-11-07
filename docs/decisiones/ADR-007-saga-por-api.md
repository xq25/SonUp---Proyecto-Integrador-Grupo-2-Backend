# ADR-007 · Los datos de Saga se consumen por su API

| | |
|---|---|
| **Estado** | Aceptada (falta el usuario de servicio que entregará el equipo de seguridad, §4) |
| **Fecha** | 2026-11-07 |
| **Decidió** | Equipo del módulo |
| **Dependencias** | Ninguna nueva: se usa `fetch` nativo de Node |
| **Relacionado** | [ADR-003](ADR-003-autenticacion-modulo-administrativo.md) · [ADR-006](ADR-006-administrativos-desde-saga.md) · `docs/CONTEXTO_Y_ARQUITECTURA.md` §3.3 |

## 1. Contexto

- Hasta ahora leíamos los datos del módulo administrativo (Saga) directamente de su esquema de Postgres (`administrativo`) con Prisma.
- **Saga va en una base de datos separada** y solo expone su información por una API REST: `https://saga-up-backend-lr4u.onrender.com`, documentada en `/api-docs`. Las rutas que usa este módulo son:
  - `GET /children` y `/children/{id}`;
  - `GET /guardians` y `/guardians/{id}`;
  - `GET /children-guardians` y `/children-guardians/{id}`;
  - `GET /professionals` y `/professionals/{id}`;
  - `GET /staff` y `/staff/{id}`.
- **Autenticación:** la API exige `Authorization: Bearer <token>`, emitido por el servicio de seguridad. Es el mismo login que ya usa este módulo (ADR-003). El token sirve según los roles del usuario.
- **Formato de las respuestas:**
  - campos en `snake_case` e ids como texto;
  - catálogos como id (`sex_id`, `document_type_id`, `staff_role_id`…), y en `children` y `guardians` también anidados con su nombre (`sexes: { code, name }`);
  - las listas no aceptan filtros.

## 2. Decisión

- **Mismos puertos, nuevo adaptador.** `ChildReader`, `GuardianReader`, `ChildGuardianReader`, `ProfessionalReader` y `StaffReader` no cambian, y los servicios tampoco. Se agregan lectores HTTP en `src/administrative/infrastructure/saga/`, uno por entidad (`SagaChildReader`, …). Cada uno traduce el JSON de Saga a la entidad de dominio y descarta lo que no usamos.
- **`SagaHttpClient`:** hace solo `GET`. Un 404 en `/{id}` se lee como «no existe». Si Saga responde 401, renueva el token una vez y reintenta. Las demás fallas se traducen a `ExternalServiceError` (502/504).
- **Sesión de servicio (`ServiceSession`, `src/auth/application/`):**
  - el backend inicia sesión **una vez** con un usuario técnico (`SAGA_SERVICE_EMAIL` / `SAGA_SERVICE_PASSWORD`), mediante el mismo `AuthGateway` del login;
  - reutiliza el token en cada llamada a Saga y lo renueva cuando vence o cuando Saga lo rechaza;
  - es independiente de la sesión de los usuarios del front.
- **Filtros y uniones en nuestro backend:**
  - `search`, `statusId`, `roleId` y `timeDonor` se filtran en memoria;
  - los vínculos joven–acudiente se unen con las listas de jóvenes o de acudientes.
- **Selección por entorno (`src/container.ts`):**
  - **con `SAGA_API_URL`**, los lectores consultan Saga;
  - **sin ella**, se leen las tablas simuladas del esquema `administrativo` (`database/dev/administrativo_simulado.sql`), solo para desarrollo, el seed y las pruebas locales;
  - al arrancar, la API indica en el log qué fuente usa.
- **Entidades alineadas con Saga** (cambio en las respuestas de la API):

| Entidad | Antes | Ahora |
|---|---|---|
| `Child` | `sex`, `documentType`, `statusId` (números) | `sexId`/`sexName`, `documentTypeId`/`documentTypeName`, `statusId`/`statusName` (texto) |
| `Guardian` | `documentType`, `legalStatusId` | `documentTypeId`/`documentTypeName`, `legalStatusId`/`legalStatusName` |
| `ChildGuardian` | `guardianshipType` | `guardianshipTypeId` |
| `Professional` | `staffId` obligatorio | `staffId` puede ser `null` |
| `Staff` | `role`, `status`, `documentType` | `roleId`, `statusId`, `documentTypeId` |

- **Filtros de las rutas:** `GET /children?statusId=` recibe el id de texto, y `GET /staff` pasa de `role`/`status` a `roleId`/`statusId`.

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir leyendo su esquema con Prisma | Saga va en otra base; no tendremos acceso a sus tablas |
| Reenviar a Saga el token del usuario del front | Hoy las rutas de este módulo no exigen el token del login (en pausa, ADR-003) y el front no siempre lo tiene. Un usuario de servicio funciona ya y no depende de cada usuario |
| Quitar los lectores Prisma | Sin Saga no habría forma de desarrollar ni probar en local; el simulado sigue siendo útil para la BD de pruebas |
| Una librería HTTP (`axios`) | `fetch` nativo con `AbortSignal.timeout` basta |

## 4. Consecuencias

- **Pendiente con el equipo de seguridad:** el usuario de servicio de este módulo, con un rol que permita leer esas rutas de Saga. Sin él, con `SAGA_API_URL` configurada, las rutas que consultan Saga responden 503 (falta configuración) o 502 (login rechazado).
- **Rendimiento:** cada consulta de un joven, acudiente o tallerista es una llamada HTTP a Saga, y las listas se traen completas porque Saga no filtra. Si las listas crecen mucho, habrá que pedirles filtros o paginación, o agregar una caché corta.
- **Disponibilidad:** si Saga está caída o lenta (Render gratuito tarda en despertar), fallan las operaciones que validan estudiantes o talleristas, como registrar asistencia o crear un taller. Conviene subir `SAGA_HTTP_TIMEOUT_MS`.
- **Ids:** los ids de Saga son los mismos que guardamos en `student_id` y `evaluator_id`. La BD de pruebas y su simulado tienen ids propios, que no coinciden con los de Saga.
- **Talleres de Saga ≠ talleres de este módulo:** `/workshops` y `/professionals-workshops` de Saga son **propuestas** de talleristas para ser aceptados en la organización. Los talleres de este módulo (`public.workshops`) son los talleres prácticos que se dictan, con sus asistencias y evaluaciones. No se consumen ni se sincronizan.
- **Cambio para el front:** cambian los nombres de algunos campos de jóvenes, acudientes, vínculos y personal (tabla de §2), y los filtros de `/staff`.
