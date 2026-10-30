# ADR-003 · Autenticación delegada al módulo administrativo

| | |
|---|---|
| **Estado** | Aceptada (la validación del token en las demás rutas sigue pendiente, §5) |
| **Fecha** | 2026-10-30 |
| **Decidió** | Equipo del módulo |
| **Dependencias** | Ninguna nueva: se usa `fetch` nativo de Node |
| **Relacionado** | [ADR-002](ADR-002-capa-http-express.md) · [api/CUERPOS_DE_PETICION.md](../api/CUERPOS_DE_PETICION.md) · `src/auth/` |

## 1. Contexto

- **El login, los usuarios, los roles y los permisos son del módulo administrativo** (equipo de seguridad e información personal). No usan Supabase Auth: tienen un servicio propio, desplegado en Render, con:
  - `POST /auth/registro`;
  - `POST /auth/login`;
  - `GET /auth/perfil`.
- **Su contrato es suyo y puede cambiar.**
  - Envían campos en español (`clave`, `rol`, `correo`).
  - Sus errores tienen otra forma: `{ "error": "…", "detalles": [{ "campo", "mensaje" }] }`.
  - La respuesta de éxito no está documentada.
  - Su token es opaco, no un JWT.
- **El front de este módulo debe hablar solo con nuestra API** (debido proceso):
  1. El front llama a nuestra función.
  2. Nuestra API la remite al módulo administrativo.
  3. Recibe su respuesta.
  4. Le devuelve al front la información en nuestro formato.
- **No se necesita un servicio de autenticación propio:** no guardamos cuentas ni sesiones.

## 2. Decisión

### 2.1 Feature `src/auth/` con inversión de dependencias

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| DTOs | `domain/auth.entity.ts` | Forma propia: `RegisterUserInput`, `LoginInput`, `AuthUser`, `AuthSession`, `RegistrationResult`. Solo los datos que usamos |
| Puerto | `domain/auth.gateway.ts` | `AuthGateway`: `register`, `login`, `getProfile(token)` |
| Adaptador | `infrastructure/http-administrative-auth.gateway.ts` | `HttpAdministrativeAuthGateway`. Arma la petición, la envía con tiempo límite y traduce el resultado a DTOs o a errores de dominio |
| Transformación | `infrastructure/administrative-auth.mapper.ts` | Su formato ↔ nuestros DTOs. Lee la respuesta de forma tolerante (varios nombres posibles por dato, respuesta envuelta en `data`, roles como texto u objeto) y descarta lo que no usamos. Si cambia su contrato, solo se toca este archivo |
| Servicio | `application/auth.service.ts` + `auth.schemas.ts` | Valida la forma (Zod, nivel 1) y llama al puerto |
| HTTP | `http/auth.routes.ts` | Rutas públicas, montadas antes de `authenticate` |
| Composición | `src/container.ts` | Único lugar que crea el adaptador con su configuración (`.env`) |

### 2.2 Rutas (públicas, bajo `/api/v1`)

| Nuestra ruta | Remite a | Respuesta |
|---|---|---|
| `POST /auth/register` `{ username, email, password, role }` | `RENDER_REGISTER_PATH` `{ username, email, clave, rol }` | 201 `RegistrationResult` |
| `POST /auth/login` `{ email, password }` | `RENDER_LOGIN_PATH` `{ email, clave }` | 200 `AuthSession` (`token`, `tokenType`, `expiresIn`, `user`) |
| `GET /auth/profile` + `Authorization: Bearer <token>` | `RENDER_PROFILE_PATH` con el mismo token | 200 `AuthUser` (`id`, `username`, `email`, `roles`) |

### 2.3 Errores

Sus respuestas se traducen a errores de dominio. Se conservan su mensaje y sus detalles, con sus nombres de campo pasados a los nuestros (`clave` → `password`):

| Ellos responden | Nosotros | HTTP |
|---|---|---|
| 400 / 422 | `ValidationError` con `details` | 400 |
| 401 | `UnauthorizedError` | 401 |
| 403 | `ForbiddenError` | 403 |
| 409 | `ConflictError` | 409 |
| 429 | `ExternalServiceError` (`rate_limited`) | 429 |
| 404, 5xx o un éxito sin los datos esperados | `ExternalServiceError` (`bad_response`) | 502 |
| Sin respuesta a tiempo | `ExternalServiceError` (`timeout`) | 504 |
| Error de red | `ExternalServiceError` (`unavailable`) | 502 |
| Sin `RENDER_API_URL` | `ExternalServiceError` (`not_configured`) | 503 |

Para que el adaptador (infraestructura) pudiera lanzarlos, `UnauthorizedError` y `ForbiddenError` pasaron de `shared/http/http-errors.ts` a `shared/domain/errors.ts`.

### 2.4 Configuración (`.env`)

| Variable | Uso |
|---|---|
| `RENDER_API_URL` | URL base del servicio administrativo |
| `RENDER_REGISTER_PATH` | Ruta de registro. Por defecto `/auth/registro` |
| `RENDER_LOGIN_PATH` | Ruta de login. Por defecto `/auth/login` |
| `RENDER_PROFILE_PATH` | Ruta de perfil. Por defecto `/auth/perfil` |
| `RENDER_HTTP_TIMEOUT_MS` | Tiempo límite por petición, en ms. Por defecto 10000 |

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| El front llama directo al módulo administrativo | Rompe el debido proceso acordado y acopla el front a su contrato, que cambia |
| Remitir su respuesta sin transformar (proxy) | El front dependería de su formato (español, errores distintos) y recibiría datos que no usamos |
| Llamar con `fetch` desde el servicio de aplicación | `application` quedaría atado al transporte HTTP. El puerto permite cambiar de proveedor o probar con un doble |
| Una librería HTTP (`axios`, `got`) | `fetch` nativo con `AbortSignal.timeout` basta; no se agrega una dependencia |

## 4. Consecuencias

- **Dependencias:** no se agrega ninguna.
- **Disponibilidad:** el login depende de la disponibilidad del servicio de Render. En el plan gratuito tarda unos 30 s en despertar, así que la primera petición puede dar 504 con el tiempo límite por defecto. Subir `RENDER_HTTP_TIMEOUT_MS` (p. ej. a 60000) o pedirles que el servicio no se duerma.
- **Límite de intentos compartido:** el servicio administrativo limita el login a 20 intentos cada 15 min por IP. Como todas las peticiones salen desde nuestro servidor, el límite lo comparten **todos** nuestros usuarios. Hay que acordar con ellos una excepción para nuestra IP, o que confíen en `X-Forwarded-For`.
- **El contrato de éxito se infirió.** No hay ejemplos de respuesta exitosa, así que el mapeador acepta los nombres más probables. Cuando lleguen ejemplos reales, se ajusta solo `administrative-auth.mapper.ts`.
- **Postman:** la carpeta "Autenticación" prueba la forma sin llamarlos. El registro válido solo corre con `runExternalWrites = true`, porque crea usuarios reales. El login válido guarda el token en `authToken`.

## 5. Pendiente

- **Las demás rutas siguen autenticando con el JWT de Supabase o `X-Actor-Id`** ([ADR-002](ADR-002-capa-http-express.md)). **En pausa (2026-10-30):** no se validan ni protegen con el token administrativo hasta que el módulo administrativo decida la tecnología del token (opaco o JWT, claves, claims, roles). Cuando se retome: para usar el token del login, `authenticate` tiene que validarlo con `AuthGateway.getProfile` (con caché). Además hay que decidir cómo pasar su id de usuario al `actor` de la auditoría: hoy es un `uuid` de `perfiles`.
- **Autorización por rol:** la decide el módulo administrativo con sus códigos de rol (`ACUDIENTE`, `DONANTE`, `ESTUDIANTE`, …).
