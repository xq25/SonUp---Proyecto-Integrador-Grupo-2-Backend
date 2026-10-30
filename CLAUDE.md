# Proyecto Integrador · Módulo de seguimiento y desarrollo de estudiantes

Módulo de servicio de un proyecto general. Consume una **base de datos general compartida** con otros módulos (Supabase / Postgres) mediante **Prisma 7**. TypeScript ESM (`module: nodenext`: los imports locales llevan extensión `.js`).

## Principios (no negociables)

- **NUNCA instalar, actualizar ni quitar dependencias sin consultar.** Antes, revisar `package.json` y `package-lock.json`.
- **NUNCA ejecutar `prisma migrate dev`, `migrate reset` ni `db push`.** El schema solo contiene las tablas de este módulo, así que Prisma intentaría borrar las de los demás.
- **NUNCA borrar físicamente.** Se usa borrado lógico (`eliminado_en`/`eliminado_por`) y las FK son `on delete restrict`, sin cascadas. Volver a crear una relación única (p. ej. habilidad de un taller) restaura la fila eliminada.
- **SIEMPRE auditar lo propio:**
  - Toda tabla nuestra lleva `habilitar_auditoria()` en el SQL.
  - Toda entidad de una tabla nuestra extiende `AuditableEntity`.
  - Todo método que escribe recibe `actor: ActorId` y usa `audit.*(actor)`.
  - Las consultas filtran `notDeleted` por defecto.
- **Código en inglés, comentarios en español.**
  - Clases, interfaces, tipos, atributos, métodos, variables, archivos y modelos/campos de Prisma van en inglés.
  - Los comentarios y los mensajes para el usuario (textos de errores) van en español.
  - Nombres en la BD:
    - Las tablas de acceso heredadas del script de login (`perfiles`, `roles`, `usuario_roles`, `aplicaciones`), las columnas de auditoría y las funciones SQL van en español.
    - Las tablas del módulo (`workshops`, `skills`, `evidences`…) van en inglés `snake_case`, como el diagrama.
    - En Prisma se mapean con `@@map`/`@map`.
  - Los valores de datos definidos por checks de la BD (`'activo'`, `'planned'`…) se escriben tal como están en la BD.
- **Los datos de otros módulos se consumen en SOLO LECTURA.**
  - Cada módulo maneja su propio esquema de Postgres. Sus tablas se mapean en Prisma con `@@schema("<esquema>")` y con sus nombres de tabla y columna tal cual.
  - Se acceden por puertos `*Reader` (nunca `*Repository`), sin create/update/delete y sin auditoría.
  - No se agregan a nuestro SQL ni se les crean FKs: nuestras columnas que los referencian (`student_id` → `children`, `evaluator_id` → `professionals`) son `bigint` sin FK física ni relación Prisma. Los servicios validan su existencia con los `*Reader`.
  - Del módulo administrativo solo se consumen `children`, `guardians`, `children_guardians` y `professionals` (feature `src/administrative/`).
- **Actores:** estudiante (`children`), acudiente (`guardians`), tallerista (`professionals`) y administrativo.
  - **No se usa `profile_id`** para enlazar actores con cuentas (decisión de diseño). `perfiles` solo identifica al `actor` que audita las operaciones.
  - Los administrativos tienen una tabla **provisional** (`administrators`, feature `src/administrators/`), aislada tras su puerto para poder reemplazarla.
- **Inversión de dependencias, arquitectura por features:**
  - `domain` no importa nada externo.
  - `application` depende solo de interfaces de repositorio.
  - `infrastructure` las implementa y es la única capa que conoce Prisma.
  - `src/container.ts` es el único sitio que conecta las implementaciones con los servicios.
  - **Un archivo por entidad en cada capa** ([ADR-004](docs/decisiones/ADR-004-un-archivo-por-entidad.md)): `<entity>.entity.ts`, `<entity>.repository.ts`, `<entities>.service.ts`, `<entity>.schemas.ts`, `prisma-<entity>.repository.ts` y `<entities>.routes.ts`. En un archivo solo van la entidad y lo suyo (DTOs, filtros, enums de estado); lo compartido por varias entidades va en un archivo aparte.
- **Prisma solo se importa desde `src/shared/infrastructure/prisma/prisma.client.ts`**, nunca desde `generated/`.
- **Zod solo en `application` y en la capa HTTP (`<feature>/http/`, para parámetros de ruta y de consulta):**
  - Nunca en `domain` ni en `infrastructure`.
  - Un esquema por entrada en `src/<feature>/application/<entity>.schemas.ts`, con `z.strictObject` y `satisfies z.ZodType<DTO>`. El DTO vive en `domain`.
  - Opcionales con `.exactOptional()`, nunca `.optional()`.
  - Se reutilizan los esquemas de `shared/application/schemas.ts` y se valida con `parseInput`.
  - Referencia: cualquier `*.schemas.ts` (p. ej. `workshops`).
  - `ZodError` se traduce a `ValidationError`.
  - Zod valida solo la forma (nivel 1); las reglas de negocio siguen en los servicios. Detalle en [ADR-001](docs/decisiones/ADR-001-zod-esquemas-de-entrada.md).
- **Toda decisión que agregue una dependencia o cambie la arquitectura** se registra como ADR en `docs/decisiones/` (contexto, decisión, alternativas, consecuencias).
- **Los repositorios devuelven entidades de dominio** (`select` explícito + `toX()`) y traducen los errores con `withPrismaErrors`.
- `auth.users` es de Supabase Auth y no se modela. `perfiles.id` es su mismo UUID, y los perfiles los crea el trigger `crear_perfil`.

## Capas y responsabilidades

Flujo de una petición:

```
Controller (entrada) → Service (application) → Repository (interfaz, domain) → Prisma<X>Repository (infrastructure)
```

| Capa | Hace | No hace |
| ---  |---   |      ---|
| **Controller / entrada** (`<feature>/http/<feature>.routes.ts`, Express 5, [ADR-002](docs/decisiones/ADR-002-capa-http-express.md)) | Recibe el request, valida parámetros de ruta y consulta, obtiene el `actor` (`actorOf(res)`), pasa el cuerpo tal cual al servicio y deja que `errorHandler` traduzca los errores de dominio a HTTP (400, 401, 403, 404, 409) | Reglas de negocio ni acceso a datos |
| **Application** (`<feature>/application/*.service.ts`) | Casos de uso y reglas de negocio; coordina repositorios; lanza errores de dominio | Saber de HTTP ni de Prisma |
| **Domain** (`<feature>/domain/`) | Entidades, tipos e interfaces de repositorio (puertos) | Importar nada externo |
| **Infrastructure** (`<feature>/infrastructure/`) | Implementa los repositorios con Prisma, mapea filas a entidades y traduce errores | Reglas de negocio |

`application` **no es el controller**. Los servicios deben poder usarse igual desde HTTP, un job, un script o un test. La capa HTTP vive en `src/shared/http/` (app, autenticación, errores, lectura de parámetros) y en un router por feature; `src/server.ts` solo arranca. Toda ruta nueva se agrega también a `routes` en `scripts/request-catalog.ts` (el generador falla si no coinciden).

## Fuentes de verdad (en este orden)

1. `database/asisco_login_supabase.sql`: nuestras tablas, checks, triggers y RLS.
2. `prisma/schema.prisma`: debe reflejar el SQL (y, para tablas de otros módulos, su modelo publicado).
3. `src/<feature>/domain`: entidades e interfaces.

Todo cambio de datos propios empieza en el SQL y baja en ese orden. Las tablas de otros módulos se definen según el modelo de ese módulo.

## Comandos

- `npm run typecheck`: correr después de cada cambio de código.
- `npm run dev`: arranca la API en `http://localhost:3000/api/v1` (recarga al guardar). Autenticación: JWT de Supabase o, solo fuera de producción, `X-Actor-Id`. **En producción `NODE_ENV=production` es obligatorio.**
- `npm run db:check`: verifica la conexión y el estado de la BD de `.env` (solo lectura).
- `npm run db:seed:dev`: datos de prueba en la BD de pruebas, vía servicios. Es idempotente y se niega a correr sin el simulado del administrativo.
- `npm run docs:requests`: regenera `docs/api/CUERPOS_DE_PETICION.md`, la colección `docs/api/postman-coleccion.json` y `docs/api/postman-casos.json`. **Al cambiar un esquema Zod o una ruta, actualiza `scripts/request-catalog.ts` y regenera**; el script falla si los ejemplos no coinciden con los esquemas o las rutas con Express.
- `npm run prisma:validate` / `npm run prisma:generate`: después de tocar el schema.
- Los comandos de la CLI de Prisma llevan `--config prisma7.config.ts`.

## Estado

- La BD general **aún no está montada en Supabase**.
- **BD de pruebas del módulo:** proyecto Supabase propio, configurado en `.env`.
  - Se prepara con `database/asisco_login_supabase.sql` + `database/dev/administrativo_simulado.sql` y se verifica con `npm run db:check`.
  - El SQL simulado **nunca** se ejecuta en la BD general.
  - Pasar a la BD general = cambiar `DATABASE_URL` y `DIRECT_URL` (ver CONTEXTO §2.1).
- El modelo se rehízo según el diagrama del módulo (Talleres, Habilidades, Evidencias). Compila y está probado en PGlite.
- **Validaciones:** las 12 tablas del módulo están aprobadas e implementadas en `docs/VALIDACIONES.md` (✅). Respetarlas; cualquier cambio de regla se acuerda primero ahí.
- **Capa HTTP: Express 5** bajo `/api/v1` ([ADR-002](docs/decisiones/ADR-002-capa-http-express.md)). 81 rutas, probadas en PGlite y en la BD de pruebas de Supabase (HTTP de punta a punta y la colección de Postman).
- **Autenticación (feature `src/auth/`, [ADR-003](docs/decisiones/ADR-003-autenticacion-modulo-administrativo.md)):** el login, los usuarios y los roles son del módulo administrativo (servicio en Render, URLs `RENDER_*` en `.env`). Nuestras rutas públicas `/auth/register`, `/auth/login` y `/auth/profile` los remiten por el puerto `AuthGateway` y devuelven nuestros DTOs; el formato de ellos solo lo conoce `administrative-auth.mapper.ts`. Las demás rutas aún autentican con JWT de Supabase o `X-Actor-Id`. Toda ruta nueva sigue yendo a `scripts/request-catalog.ts`.
- **Esquemas de entrada (nivel 1): Zod** en todas las features ([ADR-001](docs/decisiones/ADR-001-zod-esquemas-de-entrada.md)). No escribir validaciones de forma a mano en los servicios: van en los esquemas.
- **`profiles` y `access`** usan la propuesta de VALIDACIONES.md §4 (tablas del script de login). Está pendiente revisarla con el usuario.
- **Seguridad y autorización son de otro equipo** (seguridad e información personal): emiten el login (Supabase Auth) y gestionarán qué roles acceden a cada ruta. Nuestra API solo verifica el token y toma el `actor`; no implementar autorización por rol por nuestra cuenta. La propiedad de `perfiles`/`roles`/`usuario_roles` está por acordar con ellos.
- **Provisional, pendiente de confirmar:**
  - El nombre del esquema del módulo administrativo (`administrativo`).
  - La tabla `administrators` (sus validaciones sí están aprobadas).

## Referencia completa

@docs/CONTEXTO_Y_ARQUITECTURA.md
