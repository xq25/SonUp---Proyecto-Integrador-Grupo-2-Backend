# ADR-001 · Zod para los esquemas de validación de entrada

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-10-27 |
| **Decidió** | Equipo del módulo (aprobación explícita para instalar la dependencia, según la regla del `CLAUDE.md`) |
| **Dependencia** | `zod@4.6.7` en `dependencies` (se usa en ejecución, no solo en desarrollo) |
| **Relacionado** | [VALIDACIONES.md](../VALIDACIONES.md) §1 (niveles de validación) · [CONTEXTO_Y_ARQUITECTURA.md](../CONTEXTO_Y_ARQUITECTURA.md) §4 |

## 1. Contexto

El módulo valida los datos en tres niveles ([VALIDACIONES.md §1](../VALIDACIONES.md)):

| Nivel | Qué valida | Estado antes de esta decisión |
|---|---|---|
| 1. Esquema de entrada | Forma del dato: tipo, obligatorio, longitud, formato, catálogo | **Sin herramienta definida** |
| 2. Reglas de negocio | Lo que requiere consultar datos (existencia, unicidad, estados) | Implementado en los servicios |
| 3. Base de datos | `not null`, `check`, `unique`, FK | Implementado en el SQL |

Las 12 tablas tienen sus validaciones aprobadas. Al implementarlas aparecieron estos problemas en el nivel 1:

1. **Validaciones de forma escritas a mano y dispersas** en servicios y helpers: `normalizeName`, `normalizeOptionalText`, `normalizeEmail`, `ensureHttpsUrl`, `ensureValidCode`, `ensureTitle`, `ensureOrganizationName`, etc. Cada una arma sus propios mensajes de error.
2. **La entrada real llegará sin tipos.** Cuando exista la capa de entrada (HTTP u otra), los datos llegarán como JSON: ids como texto, fechas como cadenas ISO y campos faltantes, sobrantes o mal tipados. TypeScript no protege nada de eso en ejecución.
   - Ya ocurrió un caso: una URL faltante producía un `TypeError` en lugar de un error de dominio (corregido a mano en `ensureHttpsUrl`).
3. **Los tipos de entrada están duplicados.** Cada DTO (`CreateWorkshopInput`, `RegisterCredentialInput`, …) se declara como interfaz y además se valida aparte, así que ambos pueden desalinearse.
4. **Regla acordada sin implementar:** rechazar los campos desconocidos en vez de ignorarlos (VALIDACIONES.md §2).

## 2. Decisión

Se adopta **Zod** como la herramienta del **nivel 1**: un esquema por cada entrada de los servicios (crear, actualizar, filtros), que valida la forma del dato, lo normaliza y lo convierte a los tipos del dominio antes de llegar a las reglas de negocio.

### 2.1 Para qué se usará

- **Validar la forma de toda entrada** a los casos de uso. Cubre:
  - tipos y campos obligatorios;
  - longitudes;
  - formatos: email, teléfono, URL `https`, código de escala `^[A-Z0-9_]{1,30}$`, número de documento;
  - catálogos: tipos de documento y `status`.
- **Normalizar:** quitar espacios sobrantes, convertir texto vacío en `null` y el email a minúsculas. Hoy esto lo hacen a mano las funciones de `shared/domain/text.ts`.
- **Convertir tipos** de la entrada sin tipos: texto → `bigint` (ids), texto ISO → `Date`.
- **Rechazar campos desconocidos** con objetos estrictos (`z.strictObject`).
- **Inferir los tipos de entrada** desde el esquema (`z.infer`), para que el esquema sea la única fuente de verdad del DTO.
- **Reportar todos los errores a la vez**, con la ruta de cada campo, traducidos a `ValidationError` del dominio.

### 2.2 Para qué NO se usará

- **Reglas de negocio (nivel 2):** existencia, unicidad, transiciones de estado, "el taller debe estar `active`", etc. Siguen en los servicios y en las funciones `*.rules.ts`.
- **Restricciones de la BD (nivel 3):** los `check`, `unique` y FK del SQL se mantienen. Zod no los reemplaza; la BD sigue siendo la última barrera.
- **Validar lo que devuelve Prisma** ni los datos del módulo administrativo (solo lectura).
- **La capa `domain`:** no importa Zod (ver §4).

## 3. Alternativas consideradas

| Opción | Por qué no se eligió |
|---|---|
| **Validadores propios** (sin dependencias) | Era la opción sin instalar nada. Pero obliga a escribir y mantener coerción, objetos estrictos, acumulación de errores e inferencia de tipos, que es lo que hoy ya está disperso (§1). Más código propio que probar. |
| **class-validator / class-transformer** | Se basa en clases con decoradores y `reflect-metadata`. El dominio usa interfaces y funciones puras, así que habría que reescribir los DTOs como clases. |
| **Yup** | Inferencia de tipos más débil en TypeScript y menos estricta con campos desconocidos. |
| **Valibot / ArkType** | Más livianas y válidas técnicamente. Se prefirió Zod por su adopción, documentación y ecosistema (integraciones con frameworks HTTP, formularios y OpenAPI), pensando en la capa de entrada que falta definir. |

## 4. Reglas de uso

1. **Ubicación:** `src/<feature>/application/<entity>.schemas.ts`. Los esquemas reutilizables (nombre, texto opcional, email, URL https, tipo de documento, ids) van en `src/shared/application/schemas.ts`.
2. **Capas:**
   - Zod se importa solo en `application` (y en la futura capa de entrada `http/`).
   - **Nunca en `domain`**, que sigue sin dependencias externas.
   - **Nunca en `infrastructure`**.
3. **Punto de entrada:** los servicios validan su entrada con un helper común (p. ej. `parseInput(schema, data)`) que traduce `ZodError` a `ValidationError` con los campos inválidos. Así el resto del código sigue lanzando y capturando solo errores de dominio.
4. **Objetos estrictos** (`z.strictObject`): un campo desconocido es un error.
5. **Las reglas aprobadas mandan.** Cada esquema implementa lo que dice [VALIDACIONES.md](../VALIDACIONES.md) para su tabla. Si una regla cambia, se acuerda primero ahí y luego se ajustan el esquema, el servicio y el SQL.
6. **Sin duplicar ni desalinear** (ajustada en el piloto, §7):
   - Los DTO de entrada siguen definidos en `domain`, porque los usan los puertos de repositorio y `domain` no puede depender de `application`.
   - Cada esquema se declara con `satisfies z.ZodType<DTO>`: el compilador falla si el esquema y el DTO no producen exactamente lo mismo. Así hay una sola definición del contrato, verificada en compilación.
7. **Opcionales con `.exactOptional()`**, no con `.optional()`. El proyecto usa `exactOptionalPropertyTypes`: `.optional()` produce `T | undefined` y no encaja con los DTO; `.exactOptional()` sí, y además no agrega claves con `undefined`.
8. **Mensajes en español:** `z.config(z.locales.es())` en `shared/application/validation.ts`. Los mensajes propios de cada regla se escriben en español.

## 5. Consecuencias

**Positivas**

- Un único lugar por entrada para tipos, forma y normalización, con mensajes de error uniformes.
- La capa de entrada (HTTP u otra) podrá pasar datos sin tipos directamente a los servicios.
- Se cumple la regla "rechazar campos desconocidos".

**Costos y riesgos**

- **Nueva dependencia de ejecución.** Zod 4 no tiene dependencias propias. La versión mayor queda fijada en `^4`; actualizar a una mayor nueva requiere revisar este ADR.
- **Migración pendiente:**
  - las validaciones manuales actuales del nivel 1 (`text.ts`, `urls.ts`, `ensureValidCode`, `ensureTitle`, …) se moverán a esquemas, feature por feature;
  - durante la transición conviven ambos enfoques.
- **Recordatorio para el equipo:** Zod solo cubre el nivel 1; las reglas de negocio siguen en los servicios.

## 6. Verificación realizada

- **Compatibilidad:** `npm ls` muestra `zod@4.6.7` sin dependencias transitivas nuevas. `prisma generate` y `npm run typecheck` (TypeScript 7, `module: nodenext`) siguen pasando.
- **Prueba rápida en ESM con `tsx`:**
  - convierte `"12"` a `bigint`;
  - acepta solo URLs `https`;
  - rechaza un código en minúsculas;
  - reporta los campos inválidos por ruta.

## 7. Piloto: `workshops` (2026-10-27)

**Implementado:**

- **`src/shared/application/validation.ts`:** `parseInput(schema, data, entity)`.
  - Valida la entrada y la normaliza.
  - Traduce `ZodError` a `ValidationError` con `details: { path, message }[]`, un elemento por campo inválido; los campos sobrantes se reportan con su nombre.
  - Activa los mensajes en español.
- **`src/shared/application/schemas.ts`:** esquemas reutilizables de las reglas generales (VALIDACIONES.md §2):
  - `idSchema`: `bigint` > 0; acepta texto.
  - `nameSchema(min, max)`: sin espacios sobrantes.
  - `optionalTextSchema(max)`: vacío → `null`.
  - `emailSchema`, `httpsUrlSchema`, `dateTimeSchema` (ISO 8601) y `documentTypeSchema`.
- **`src/workshops/application/workshop.schemas.ts`:** `createWorkshopSchema`, `updateWorkshopSchema`, `registerAttendanceSchema` y `updateAttendanceSchema`.
- **Servicios:** `WorkshopsService.create/update` y `AttendanceService.register/update` validan primero con su esquema. Se quitó la normalización manual que ya hace el esquema (nombre, observación y el chequeo "nace `planned`").
- **Cambio en el dominio:** `ValidationError` ahora tiene `details`, que por defecto es una lista vacía. Sigue sin depender de Zod.

**Comprobado con la prueba de punta a punta** (188 casos, 11 del piloto):

- campo desconocido → error en ese campo;
- ids y fechas como texto, como llegarán por HTTP, se convierten;
- varios errores se reportan a la vez, por campo;
- fecha inválida, id negativo y `status` fuera del catálogo dan error en su campo;
- observación de más de 1000 caracteres y campo obligatorio faltante dan error;
- los mensajes salen en español.

**Resultado:** patrón aprobado por el equipo; se aplicó al resto del módulo (§8).

## 8. Migración completa (2026-10-27)

**Features migradas**, con el patrón del piloto (cada servicio valida su entrada con `parseInput` antes de las reglas de negocio):

| Feature | Archivo de esquemas | Entradas |
|---|---|---|
| `workshops` | `workshop.schemas.ts` | crear y actualizar taller; registrar y actualizar asistencia (piloto) |
| `administrators` | `administrator.schemas.ts` | crear y actualizar |
| `skills` | `skill.schemas.ts` | crear y actualizar categorías y habilidades |
| `evaluations` | `evaluation.schemas.ts` | crear y actualizar escalas; evaluar |
| `evidences` | `evidence.schemas.ts` | subir y actualizar evidencias; registrar y actualizar credenciales |
| `profiles` | `profile.schemas.ts` | actualizar |
| `access` | `access.schemas.ts` | crear rol y aplicación; asignar rol |

`administrative` no tiene esquemas: solo lee. Los parámetros sueltos (ids en `get`, `addSkill`, `linkStudent`…) y los filtros de `list` siguen tipados por TypeScript, sin esquema.

**Esquemas compartidos agregados:** `personNameSchema` (solo letras, tildes, espacios, `'` y `-`), `phoneSchema` (E.164), `documentNumberSchema` y `uuidSchema`.

`uuidSchema` usa `z.guid()`: valida solo el formato 8-4-4-4-12 como el tipo `uuid` de Postgres. `z.uuid()` exige versión y variante RFC y rechazaba ids válidos para la BD.

**Validadores manuales retirados:**

| Retirado | Reemplazo |
|---|---|
| `ensureHttpsUrl` y `shared/domain/urls.ts` | `httpsUrlSchema` |
| `ensureValidCode` (escalas) | `scaleCode` en `evaluation.schemas.ts` |
| `ensureTitle` y `ensureOrganizationName` | `nameSchema(2, 150)` |
| Normalizaciones manuales de los servicios | Los esquemas |
| `shared/domain/text.ts` | `normalizeName`/`normalizeEmail` pasaron, internas, a `shared/application/schemas.ts`; `normalizeOptionalText` quedó sin uso y se eliminó |

**Se mantuvieron en los servicios o el dominio** (nivel 2): unicidad, existencia, transiciones de estado, estudiante activo, el cruce `min ≤ num ≤ max` sobre el resultado final (`ensureValidScaleValues`) y las reglas de taller, asistencia, evaluación y credenciales.

**Nota para `profiles` y `access`:** son tablas del script de login. Sus esquemas aplican la **propuesta** de VALIDACIONES.md §4, que aún no se ha revisado tabla por tabla.

**Verificación:** typecheck sin errores y prueba de punta a punta con 200 casos (12 nuevos para las features migradas).
