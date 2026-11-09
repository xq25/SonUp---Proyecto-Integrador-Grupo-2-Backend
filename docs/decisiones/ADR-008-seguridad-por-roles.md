# ADR-008 · Seguridad de nuestras rutas con el token y los roles del servicio de seguridad

| | |
|---|---|
| **Estado** | Aceptada. Ajustada el 2026-11-08 al contrato común del servicio de seguridad (§2.1 y §2.6) |
| **Fecha** | 2026-11-08 |
| **Decidió** | Equipo del módulo, de acuerdo con el equipo de seguridad |
| **Dependencias** | Ninguna nueva: `jose` (ya instalado) y `node:async_hooks` |
| **Relacionado** | [ADR-002](ADR-002-capa-http-express.md) (reemplaza su §2.2) · [ADR-003](ADR-003-autenticacion-modulo-administrativo.md) · [ADR-007](ADR-007-saga-por-api.md) |

## 1. Contexto

- **Las sesiones son del servicio de seguridad.** El login (`/auth/login`) entrega un **JWT HS256** con el usuario y sus roles, por ejemplo `{ "roles": ["ADMIN"], "sub": "20", "exp": … }`, que dura 8 horas. **Es el mismo token que usa Saga.**
- **Ellos entregan los roles, nosotros protegemos.** El equipo de seguridad nos da los roles de cada usuario y **este módulo protege sus propias rutas** según esos roles. Esto reemplaza lo anotado antes: «la autorización la gestiona el equipo de seguridad».
- **Contrato común del servicio de seguridad (2026-11-08)**, igual para todos los backends del proyecto:
  - cada backend verifica el JWT **localmente** con el secreto compartido `JWT_SECRET`, sin consultar al servidor de seguridad en cada petición;
  - el token trae `sub` (texto, id estable del usuario), `roles` (lista de textos), `iat`, `exp` y, si se usa, `nbf`;
  - 401 ante token inválido o vencido, 403 ante rol insuficiente, y error de configuración si falta el secreto.
- **El enlace usuario ↔ persona lo guarda Saga:** cada usuario se registra o enlaza con `POST /staff/register` (TALLERISTA), `POST /children/register` (ESTUDIANTE) o `POST /guardians/register` (ACUDIENTE), usando su propio JWT. Saga guarda el `sub` en `security_user_id` de `staff`, `children` o `guardians`.
- **Nuestra API autenticaba con otra cosa:** JWT de Supabase o `X-Actor-Id`. El actor de la auditoría era un `uuid` de `perfiles`, que no corresponde a los usuarios del servicio de seguridad.

## 2. Decisión

### 2.1 Verificación del token: local, con `JWT_SECRET`

- **`JwtTokenVerifier`** (puerto `TokenVerifier`) verifica con `jose` la firma (**solo `HS256`**), `exp` y `nbf`. No se limita a decodificar.
- **Tipos estrictos:** `sub` debe ser texto no vacío y `roles` una lista de textos. Si no, responde 401. Los roles se normalizan a mayúsculas.
- **Sin `JWT_SECRET`:**
  - **En producción**, la API no arranca: falla en `createContainer`.
  - **Fuera de producción**, arranca para probar con las cabeceras de desarrollo, pero todo token se rechaza con 503 («falta JWT_SECRET»). Nunca se acepta un token sin verificar.
- **No se consulta `/auth/perfil` en cada petición.** Ese endpoint solo lo usa nuestra ruta pública `GET /auth/profile` (ADR-003).
- **El secreto nunca se registra en logs** ni va al repositorio, al front o a la documentación. Si el equipo de seguridad lo rota, solo hay que actualizar la variable.

### 2.2 Autenticación (`src/shared/http/authenticate.ts`)

- **`Authorization: Bearer <token>`:** se verifica el token. El `actor` es su `sub`, y sus roles quedan en `res.locals`.
- **Solo fuera de producción:** `X-Actor-Id: <id>` y `X-Actor-Roles: TALLERISTA`, para pruebas manuales. Sin `X-Actor-Roles` se asume `ADMIN`. Para probar "lo suyo" (§2.6): `X-Actor-Professional-Id`, `X-Actor-Staff-Id`, `X-Actor-Child-Id` o `X-Actor-Guardian-Id`.
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
| Acudientes, talleristas y personal (Saga) | Todo | Su propio perfil (`/staff/:id`, `/professionals/:id`, `/professionals/by-staff/:staffId`) | — | Él mismo (acudiente) |
| Talleres: ver | Todo | **Solo los suyos** | Disponibles (`planned`, `active`) y en los que participó | Igual, por sus jóvenes |
| Talleres: publicar (crear), editar, cambiar estado, eliminar; habilidades del taller | Todo | Solo los suyos | — | — |
| Asistencias y evaluaciones: tomar, corregir, eliminar | Todo | En sus talleres | — | — |
| Historial: asistencias, detalle de evaluaciones, calificaciones y promedios por categoría | Todo | Todos los jóvenes | Lo suyo | Sus jóvenes |
| Árbol de habilidades y escalas | Define | Consulta | Solo sus habilidades calificadas (con nombre, categoría y escala) y las escalas (leyenda de niveles) | Igual, por sus jóvenes |
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

- **El rol dice qué tipo de usuario es, no cuál.** Para limitar a un tallerista a sus talleres, o a un joven a lo suyo, hace falta saber a quién de Saga corresponde: su `professional_id`, `child_id` o `guardian_id`.
- **El enlace sale de Saga, no del token.** `ActorLinksService` (puerto `ActorLinksResolver`) busca el `sub` en `security_user_id`:
  - **TALLERISTA:** `staff` → su `professional` (por `staff_id`) → `professionalId`.
  - **ESTUDIANTE:** `children` → `childId`.
  - **ACUDIENTE:** `guardians` → `guardianId`.
- **Cómo se busca:** Saga no filtra por ese campo, así que se recorre el listado con el token del usuario. Los enlaces encontrados se guardan `AUTH_LINK_CACHE_SECONDS` segundos (300 por defecto). Los no encontrados no se guardan, para que un usuario recién enlazado no tenga que esperar.
- **Solo se resuelve cuando hace falta:** en las rutas de "lo suyo" y nunca para ADMIN.
- **En desarrollo** las cabeceras `X-Actor-Professional-Id`, `X-Actor-Staff-Id`, `X-Actor-Child-Id` y `X-Actor-Guardian-Id` reemplazan la búsqueda (`src/auth/domain/actor-links.ts`).
- **`AccessPolicy` (`src/auth/application/access-policy.ts`)** decide, dentro de cada ruta que el rol permite, a qué registros se accede:
  - **Tallerista:** lista solo sus talleres, crea talleres solo a su nombre (`evaluatorId`), y gestiona habilidades, asistencias y evaluaciones solo en sus talleres. Consulta su propio perfil (`staff` y `professional`), no el de otros.
  - **Joven:** lo suyo. **Acudiente:** lo de sus jóvenes con vínculo vigente (Saga `children-guardians`).
  - Ambos listan solo talleres `planned`/`active`, y ven el detalle de un taller si está disponible o si participaron en él.
- **Sin enlace en Saga** se responde **403** («tu cuenta no está enlazada…: regístrate o enlázate primero»). Si el registro no existe, se deja seguir y el servicio responde 404.
- La llaman las rutas, antes del servicio. Las reglas de negocio (§3.6 de VALIDACIONES) siguen en los servicios.

### 2.7 Lo que recibe el front al iniciar sesión

`POST /auth/login` y `GET /auth/profile` agregan, a lo que devuelve el servicio de seguridad (2026-11-09, pedido del equipo de front):

```json
{
  "token": "eyJ…", "tokenType": "Bearer", "expiresIn": 28800, "expiresAt": "2026-11-09T18:32:00.000Z",
  "user": { "id": "32", "username": "…", "email": "…", "roles": ["ACUDIENTE"] },
  "saga": { "linked": true, "professionalId": null, "staffId": null, "childId": null, "guardianId": "9", "childIds": ["4"] }
}
```

- **`user.id` y `user.roles`** salen del token verificado, así llegan aunque el servicio de seguridad no los incluya en su respuesta.
- **`expiresAt`** es el `exp` del token.
- **`saga`** son los ids de Saga del usuario, según su rol, resueltos con `ActorLinksService`:
  - **TALLERISTA:** `professionalId` (el `evaluatorId` de sus talleres) y `staffId`.
  - **ESTUDIANTE:** `childId`.
  - **ACUDIENTE:** `guardianId` y `childIds` (sus jóvenes con vínculo vigente).
- **Si la cuenta no está enlazada**, llega `linked: false` y el front puede enviarla a registrarse en Saga. ADMIN y DONANTE siempre tienen `linked: false`.
- **Es de mejor esfuerzo:** si el token no se puede verificar o Saga no responde, el login no falla y `saga` llega en `null`. El front puede reintentar con `GET /auth/profile`.
- **No se envían datos personales de Saga** (nombre, documento, anamnesis): el front los pide con esos ids.

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Verificar con el endpoint de perfil del servicio de seguridad | El contrato común pide verificación local. El endpoint añadía una llamada de red, latencia y una caché que aceptaba tokens revocados. Se implementó y se retiró el 2026-11-08 |
| Pedir el id de Saga como claim del token | El servicio de seguridad no lo emite: el enlace vive en Saga (`security_user_id`), que es dueña de las personas |
| Decodificar el JWT sin verificar la firma | Cualquiera podría fabricarse un token con rol `ADMIN` |
| Permisos dentro de cada router (`requireRoles` por ruta) | Quedarían repartidos en 20 archivos. Una sola matriz se revisa y se entrega más fácil, y el generador valida que esté completa |
| Mantener el actor como `uuid` de `perfiles` | Exige enlazar cada usuario del servicio de seguridad con un perfil nuestro, y duplica cuentas |
| Usar siempre el usuario de servicio con Saga | Saga no podría aplicar los permisos de cada usuario |
| "Lo suyo" solo por rol | Cualquier joven vería las calificaciones, evidencias y certificados de todos los demás |
| Enlazar el tallerista por email (login = `staff.email`) | Solo serviría para talleristas y depende de que los emails coincidan. Jóvenes y acudientes no tienen email en Saga |

## 4. Consecuencias y pendientes

- **`JWT_SECRET`:** se recibe por un canal seguro y se configura en Render. Sin él, producción no arranca.
- **Cada usuario debe enlazarse en Saga** (`POST /…/register` con su propio JWT) antes de usar las rutas de "lo suyo". Ese paso lo hace el front contra Saga: este módulo no escribe en Saga.
- **«Solo el tallerista del taller evalúa»** (VALIDACIONES §3.9) queda cubierto por `AccessPolicy`.
- **Tokens revocados:** como la verificación es local, un token sigue siendo válido hasta su `exp` (8 h). Es lo que define el contrato común.
- **Un enlace cambiado en Saga** (por ejemplo, un tallerista enlazado a otro registro) tarda hasta `AUTH_LINK_CACHE_SECONDS` en verse.
- **Si Saga restringe en el futuro la lectura de listados por rol,** la búsqueda del enlace con el token del usuario podría fallar. En ese caso hará falta un endpoint de Saga tipo `/me`, o usar el usuario de servicio.
- **BD de pruebas:** hay que ejecutar la migración de auditoría antes de usar tokens cuyo `sub` no es UUID.
- **`perfiles`, `roles`, `usuario_roles` y `aplicaciones`** quedan sin uso para la autenticación y solo para `ADMIN`. Hay que decidir si se retiran.
- **El front** debe enviar `Authorization: Bearer <token del login>` en cada petición y manejar 401 (sesión vencida) y 403 (sin permiso).
