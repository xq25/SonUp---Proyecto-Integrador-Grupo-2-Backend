# ADR-002 · Capa de entrada HTTP con Express 5

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-10-27 |
| **Decidió** | Equipo del módulo (aprobación explícita del framework, la autenticación, las rutas y las dependencias) |
| **Dependencias** | `express@5.3.0`, `cors@2.8.6` y `jose@6.2.13` (ejecución); `@types/express@5.0.6` y `@types/cors@2.8.19` (desarrollo) |
| **Relacionado** | [ADR-001](ADR-001-zod-esquemas-de-entrada.md) · [api/CUERPOS_DE_PETICION.md](../api/CUERPOS_DE_PETICION.md) · `CLAUDE.md` § Capas y responsabilidades |

## 1. Contexto

- **Los servicios existen, pero nada los expone.** Están completos, con reglas de negocio y validación de entrada (Zod), pero solo se pueden usar desde código: no hay rutas que Postman, el frontend u otros módulos puedan llamar.
- **Postman no puede usar los casos todavía.** El documento de cuerpos de petición y sus 62 casos están listos, pero les faltan URLs.
- **Falta el origen del `actor`.** Todo método que escribe necesita el usuario autenticado, y debe salir de la sesión de Supabase Auth.
- **Restricciones de arquitectura:** el `CLAUDE.md` ya preveía una capa `<feature>/http/` que solo recibe la petición, obtiene el actor, llama al servicio y traduce los errores de dominio a HTTP, **sin reglas de negocio**.

## 2. Decisión

### 2.1 Framework: Express 5

- Es el framework HTTP más conocido por el equipo y el que tiene más ejemplos y middlewares.
- La versión 5 maneja de forma nativa los errores de las funciones `async`, así que un error de dominio llega solo al manejador central.
- `cors` permite que el frontend (otro origen) consuma la API.

### 2.2 Autenticación: JWT de Supabase y cabecera solo en desarrollo

| Modo | Cómo se obtiene el `actor` | Cuándo |
|---|---|---|
| **JWT de Supabase** | `Authorization: Bearer <access_token>`. Se verifica con `jose` (firma, emisor `${SUPABASE_URL}/auth/v1` y audiencia `authenticated`); el `actor` es el claim `sub` (= `perfiles.id`) | Siempre |
| **Cabecera de desarrollo** | `X-Actor-Id: <uuid de un perfil>`, sin token | Solo si `NODE_ENV !== "production"`; en producción se rechaza |

- **Verificación de la firma.** Se usa la clave pública del proyecto (JWKS en `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`). Si el proyecto usa el secreto compartido antiguo, se define `SUPABASE_JWT_SECRET` y se verifica con HS256.
- **El perfil debe existir y estar `activo`.** Si no, la petición se rechaza con **401** o **403**.
- **Todas las rutas `/api/v1` exigen actor**, salvo `GET /api/v1/health`. El backend usa una conexión que no aplica RLS, así que la API no puede quedar abierta.

### 2.3 Rutas: REST en inglés bajo `/api/v1`

- **Coherentes con el código:** recursos en plural y `kebab-case` (`/workshops`, `/skill-categories`, `/evaluation-scales`).
- **Verbos:**
  - `POST` crea → **201**.
  - `PATCH` actualiza → **200**.
  - `DELETE` hace borrado lógico → **204**.
  - `POST …/restore` restaura.
  - `PUT /a/:id/b/:bId` asocia y `DELETE` la misma ruta desasocia.
- **Relaciones como subrecursos:** `/workshops/:id/skills/:skillId`, `/students/:studentId/attendances`, etc.

### 2.4 Convenciones de la API

- **Ids:** en la entrada son número o texto; en las respuestas, **texto** (`"12"`). Son `bigint`, y un número JSON perdería precisión por encima de 2^53.
- **Fechas:** ISO 8601 en UTC.
- **Errores:** `{ "error": { "code", "message", "details"? } }`.

  | Error | HTTP |
  |---|---|
  | `ValidationError` o JSON inválido | 400 |
  | Sin actor o token inválido | 401 |
  | Perfil inactivo | 403 |
  | `NotFoundError` o ruta inexistente | 404 |
  | `ConflictError` | 409 |
  | Error inesperado | 500 (sin detalles internos) |

## 3. Alternativas consideradas

| Opción | Por qué no |
|---|---|
| **Hono** | Más liviano y con rutas tipadas, pero menos conocido por el equipo. |
| **Fastify** | Más rendimiento y validación propia por esquemas, pero duplicaría Zod y tiene más curva de aprendizaje. |
| **Solo la cabecera `X-Actor-Id`** | Sin dependencias, pero cualquiera podría hacerse pasar por otro usuario; aceptable solo en desarrollo. |
| **Solo JWT desde ya** | Obligaría a iniciar sesión para cada prueba manual en Postman. |
| **`@supabase/supabase-js` para validar tokens** | Valida contra el servidor de Supabase en cada petición. `jose` valida localmente con la clave pública. |

## 4. Reglas de uso

1. **Ubicación:** cada feature expone sus rutas en `src/<feature>/http/<feature>.routes.ts`, como `create<Feature>Router(services)`.
2. **Infraestructura común HTTP** en `src/shared/http/`: la app, el manejo de errores, el actor, el parseo de parámetros y la serialización.
3. **El controller no tiene reglas de negocio.**
   - Lee `params`, `query` y `body`, y obtiene el `actor`.
   - Llama al servicio y responde.
   - El cuerpo va **tal cual** al servicio, que lo valida con su esquema Zod (ADR-001).
   - Los parámetros de ruta y de consulta se validan en la capa HTTP con Zod.
4. **`src/server.ts`** solo arranca el servidor. **`createApp(container)`** construye la app sin escuchar puertos, para poder probarla.
5. **Nada de Prisma ni de repositorios en `http/`:** solo servicios del contenedor.

## 5. Consecuencias

**Positivas**

- Los 62 casos del catálogo se ejecutan en Postman con una colección generada.
- El frontend y otros módulos pueden consumir el módulo.
- El `actor` sale de la sesión real de Supabase.

**Costos y riesgos**

- **Tres dependencias de ejecución nuevas.** Las versiones mayores quedan fijadas en `^5`, `^2` y `^6`.
- **La cabecera `X-Actor-Id` es peligrosa** si `NODE_ENV` no queda en `production` al desplegar: es una regla de despliegue obligatoria.
- **Vulnerabilidades heredadas de Prisma.** `npm audit` reporta 5 en dependencias internas de la CLI de Prisma (`mysql2`, `deepmerge-ts`, `fast-uri`), no en las nuevas. Se revisarán al actualizar Prisma; requiere aprobación.
