# ADR-008 · Seguridad de nuestras rutas con el token y los roles del servicio de seguridad

| | |
|---|---|
| **Estado** | Aceptada. Pendiente: cómo llega en el token a quién de Saga corresponde el usuario (§2.6) |
| **Fecha** | 2026-11-08 |
| **Decidió** | Equipo del módulo, de acuerdo con el equipo de seguridad |
| **Dependencias** | Ninguna nueva: `jose` (ya instalado) y `node:async_hooks` |
| **Relacionado** | [ADR-002](ADR-002-capa-http-express.md) (reemplaza su §2.2) · [ADR-003](ADR-003-autenticacion-modulo-administrativo.md) · [ADR-007](ADR-007-saga-por-api.md) |

## 1. Contexto

- **Las sesiones son del servicio de seguridad.** El login (`/auth/login`) entrega un **JWT HS256** con el usuario y sus roles, por ejemplo `{ "roles": ["ADMIN"], "sub": "20", "exp": … }`, que dura 8 horas. **Es el mismo token que usa Saga.**
- **Ellos entregan los roles, nosotros protegemos.** El equipo de seguridad nos da los roles de cada usuario y **este módulo protege sus propias rutas** según esos roles. Esto reemplaza lo anotado antes: «la autorización la gestiona el equipo de seguridad».
- **Falta definir cómo verificar el token.** Puede ser con el secreto del JWT o consultando su endpoint de perfil.
- **Nuestra API autenticaba con otra cosa:** JWT de Supabase o `X-Actor-Id`. El actor de la auditoría era un `uuid` de `perfiles`, que no corresponde a los usuarios del servicio de seguridad.

## 2. Decisión

### 2.1 Verificación del token: puerto `TokenVerifier`, dos adaptadores

| Adaptador | Cuándo | Cómo |
|---|---|---|
| `JwtTokenVerifier` | Con `AUTH_JWT_SECRET` | Verifica localmente la firma HS256 y el vencimiento, y el emisor y la audiencia si se configuran (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`). Lee `sub` y `roles` |
| `RemoteTokenVerifier` | Sin `AUTH_JWT_SECRET` | Consulta el endpoint de perfil del servicio de seguridad (`RENDER_PROFILE_PATH`) con el token, y guarda la respuesta `AUTH_PROFILE_CACHE_SECONDS` segundos (60 por defecto) |

`src/container.ts` elige el adaptador, y el arranque lo indica en el log. Ambos devuelven un `Principal { userId, roles }`.

### 2.2 Autenticación (`src/shared/http/authenticate.ts`)

- **`Authorization: Bearer <token>`:** se verifica el token. El `actor` es su `sub`, y sus roles quedan en `res.locals`.
- **Solo fuera de producción:** `X-Actor-Id: <id>` y `X-Actor-Roles: TALLERISTA`, para pruebas manuales. Sin `X-Actor-Roles` se asume `ADMIN`. Para probar "lo suyo" (§2.6): `X-Actor-Professional-Id`, `X-Actor-Child-Id` o `X-Actor-Guardian-Id`.
- **Se retira la verificación del JWT de Supabase y la búsqueda del perfil en `perfiles`.** Las variables `SUPABASE_URL` y `SUPABASE_JWT_SECRET` dejan de usarse.

### 2.3 Autorización por rol (`authorize` + `route-permissions.ts`)

- **`src/shared/http/route-permissions.ts` es el único lugar donde se decide quién accede.** Asigna a cada ruta protegida (`"MÉTODO /ruta"`) sus roles permitidos.
- **El middleware `authorize`** va después de `authenticate`. Busca la ruta de la petición (la más específica si hay varias) y responde **403** si el usuario no tiene ninguno de los roles.
- **`npm run docs:requests` falla** si una ruta protegida no está en la matriz, o si la matriz nombra una ruta que no existe. La columna **Roles** aparece en `CUERPOS_DE_PETICION.md` y en Swagger.
- **Roles válidos** (los del servicio de seguridad): `ADMIN`, `TALLERISTA`, `ESTUDIANTE`, `ACUDIENTE` y `DONANTE`. Están en `src/auth/domain/roles.ts`.
- **Matriz acordada por flujos (2026-11-08):**

| Flujo | ADMIN | TALLERISTA | ESTUDIANTE | ACUDIENTE |
|---|---|---|---|---|
| Datos personales de los jóvenes (Saga, con anamnesis) | Todo | Todos | Él mismo | Sus jóvenes |
| Acudientes, talleristas y personal (Saga) | Todo | — | — | Él mismo (acudiente) |
| Talleres: ver | Todo | **Solo los suyos** | Disponibles (`planned`, `active`) y en los que participó | Igual, por sus jóvenes |
| Talleres: publicar (crear), editar, cambiar estado, eliminar; habilidades del taller | Todo | Solo los suyos | — | — |
| Asistencias y evaluaciones: tomar, corregir, eliminar | Todo | En sus talleres | — | — |
| Historial: asistencias, detalle de evaluaciones, calificaciones y promedios por categoría | Todo | Todos los jóvenes | Lo suyo | Sus jóvenes |
| Árbol de habilidades y escalas | Define | Consulta | Solo sus calificaciones por categoría | Igual, por sus jóvenes |
| Evidencias y certificados: subir, editar, retirar | Todo | Todo | — | — |
| Evidencias y certificados: ver | Todo | Todo | Los suyos | Los de sus jóvenes |
| Cuentas y acceso heredados (`perfiles`, `roles`…), recálculo manual | Todo | — | — | — |

  `DONANTE` aún no tiene acceso a este módulo.

### 2.4 El token del usuario viaja a Saga

- `authenticate` guarda el token en el **contexto de la petición** (`AsyncLocalStorage`, `src/shared/infrastructure/request-context.ts`).
- `RequestSagaTokenSource` lo envía a Saga en cada consulta, así que Saga aplica los permisos de ese usuario.
- **Si Saga lo rechaza:** con 401 respondemos 401 («inicia sesión de nuevo»), y con 403 respondemos 403.
- **Sin token de usuario** (scripts, jobs, o desarrollo con `X-Actor-Id`), se usa la sesión de servicio de ADR-007 (`SAGA_SERVICE_*`).

### 2.5 Auditoría con el `sub`

- `creado_por`, `actualizado_por` y `eliminado_por` pasan de `uuid` a **`text`**, con el `sub` del token (por ejemplo `"20"`). El cambio está en `habilitar_auditoria()`, en `auditar()`, en `borrado_logico()` y en Prisma.
- **Bases ya creadas:** `database/migraciones/2026-11-08-auditoria-actor-texto.sql` hace la conversión sin perder datos.
- **`usuario_roles.asignado_por`** sigue siendo FK a `perfiles`: queda vacío cuando el actor no es un perfil.
- **`GET /profiles/me`** responde 404 si el actor no es un perfil.

### 2.6 "Lo suyo": `AccessPolicy`

- **El rol dice qué tipo de usuario es, no cuál.** Para limitar a un tallerista a sus talleres, o a un joven a lo suyo, hace falta saber a quién de Saga corresponde: su `professional_id`, `child_id` o `guardian_id`. Saga no tiene ese vínculo: `children` y `guardians` no tienen usuario ni email.
- **Por eso el `Principal` trae `links`** (`professionalId`, `childId`, `guardianId`), leídos de claims del token. Se aceptan varios nombres mientras el servicio de seguridad confirma el suyo (`src/auth/domain/actor-links.ts`). Con el endpoint de perfil todavía no se leen.
- **`AccessPolicy` (`src/auth/application/access-policy.ts`)** decide, dentro de cada ruta que el rol permite, a qué registros se accede:
  - **Tallerista:** lista solo sus talleres, crea talleres solo a su nombre (`evaluatorId`), y gestiona habilidades, asistencias y evaluaciones solo en sus talleres.
  - **Joven:** lo suyo. **Acudiente:** lo de sus jóvenes con vínculo vigente (Saga `children-guardians`).
  - Ambos listan solo talleres `planned`/`active`, y ven el detalle de un taller si está disponible o si participaron en él.
- **Sin enlace en el token** se responde **403** («tu usuario no está enlazado…»). Si el registro no existe, se deja seguir y el servicio responde 404.
- La llaman las rutas, antes del servicio. Las reglas de negocio (§3.6 de VALIDACIONES) siguen en los servicios.

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Solo el secreto del JWT, o solo el endpoint | Todavía no está definido cuál entregará el equipo de seguridad. El puerto permite ambos sin rehacer nada |
| Decodificar el JWT sin verificar la firma | Cualquiera podría fabricarse un token con rol `ADMIN` |
| Permisos dentro de cada router (`requireRoles` por ruta) | Quedarían repartidos en 20 archivos. Una sola matriz se revisa y se entrega más fácil, y el generador valida que esté completa |
| Mantener el actor como `uuid` de `perfiles` | Exige enlazar cada usuario del servicio de seguridad con un perfil nuestro, y duplica cuentas |
| Usar siempre el usuario de servicio con Saga | Saga no podría aplicar los permisos de cada usuario |
| "Lo suyo" solo por rol | Cualquier joven vería las calificaciones, evidencias y certificados de todos los demás |
| Enlazar el tallerista por email (login = `staff.email`) | Solo serviría para talleristas y depende de que los emails coincidan. Jóvenes y acudientes no tienen email en Saga |

## 4. Consecuencias y pendientes

- **Pedir al servicio de seguridad** que el token incluya el id en Saga del usuario: `professionalId` (tallerista), `childId` (joven) y `guardianId` (acudiente). Sin él, talleristas, jóvenes y acudientes reciben 403 en las rutas de "lo suyo". Si usan otros nombres, se agregan en `actor-links.ts`.
- **«Solo el tallerista del taller evalúa»** (VALIDACIONES §3.9) queda cubierto por `AccessPolicy` una vez llegue el enlace.
- **Caché del endpoint:** un token revocado puede seguir aceptándose hasta `AUTH_PROFILE_CACHE_SECONDS`.
- **BD de pruebas:** hay que ejecutar la migración de auditoría antes de usar tokens cuyo `sub` no es UUID.
- **`perfiles`, `roles`, `usuario_roles` y `aplicaciones`** quedan sin uso para la autenticación y solo para `ADMIN`. Hay que decidir si se retiran.
- **El front** debe enviar `Authorization: Bearer <token del login>` en cada petición y manejar 401 (sesión vencida) y 403 (sin permiso).
