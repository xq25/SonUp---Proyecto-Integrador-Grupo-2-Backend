# ADR-004 · Un archivo por entidad en cada capa

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-10-30 |
| **Decidió** | Equipo del módulo |
| **Dependencias** | Ninguna |
| **Relacionado** | `docs/CONTEXTO_Y_ARQUITECTURA.md` §4 · [ADR-001](ADR-001-zod-esquemas-de-entrada.md) · [ADR-002](ADR-002-capa-http-express.md) |

## 1. Contexto

- Cada feature agrupaba **varias entidades en un mismo archivo** por capa. Por ejemplo, `evidences/domain/evidence.entity.ts` tenía evidencias, relaciones estudiante–evidencia y credenciales. Pasaba lo mismo con su repositorio, sus esquemas, su adaptador Prisma y su router.
- Al explorar el código, encontrar una entidad obligaba a recorrer archivos largos con piezas ajenas.
- Algunos servicios también mezclaban entidades. `SkillsService`, por ejemplo, manejaba categorías, habilidades y calificaciones.

## 2. Decisión

- **Las features se mantienen** (`evidences/`, `skills/`, `workshops/`, …). Dentro de cada una, **cada entidad tiene sus propios archivos en las cuatro capas**:

| Capa | Archivo por entidad |
|---|---|
| `domain` | `<entity>.entity.ts`, `<entity>.repository.ts` (o `.reader.ts`), `<entity>.rules.ts` si tiene reglas puras |
| `application` | `<entities>.service.ts`, `<entity>.schemas.ts` |
| `infrastructure` | `prisma-<entity>.repository.ts` (o `prisma-<entity>.reader.ts`) |
| `http` | `<entities>.routes.ts` |

- **Pueden compartir archivo** solo los tipos que pertenecen a la entidad: sus DTOs de entrada, filtros, enums de estado y vistas derivadas (`StudentSkillGrade`, `CategoryAverage`, `ChildGuardianWithChild`).
- **Las piezas que usan varias entidades** de la feature van en un archivo propio: `access/application/catalog-code.schema.ts` y `auth/application/auth-input.schemas.ts`.
- **Cada entidad tiene su servicio y su router**, montados en `container.ts` y `app.ts` con una clave por entidad. Esto incluye las tablas de relación con reglas propias (`workshopSkills`, `studentEvidences`).
- **Las URLs no cambian.**

### Cambios en el contenedor

| Antes | Ahora |
|---|---|
| `administrative` | `children`, `guardians`, `professionals` (con el puerto nuevo `ChildGuardianReader`) |
| `access` | `apps`, `roles`, `userRoles` |
| `skills` | `skillCategories`, `skills`, `studentSkills` |
| `evaluations` | `evaluationScales`, `evaluations` |
| `workshops` | `workshops`, `workshopSkills` |
| `evidences` | `evidences`, `studentEvidences` |

Los nombres de los métodos pierden el sufijo de la entidad, que ahora lo da el servicio: `skills.createCategory` → `skillCategories.create`, `workshops.addSkill` → `workshopSkills.add`.

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Una subcarpeta por entidad (`evidences/credentials/domain/…`) | Cambia la arquitectura por features y duplica la estructura de carpetas sin ganar claridad |
| Separar solo `domain` | La mezcla también estaba en los repositorios, los esquemas y los routers |

## 4. Consecuencias

- **Más archivos, pero cortos:** cada uno con una sola entidad.
- **API HTTP sin cambios:** las mismas URLs y cuerpos, así que el front y la colección de Postman siguen igual. En el catálogo, `access.createCatalog` se separó en `apps.create` y `roles.create`.
- **Código que usa el contenedor:** cambió las claves y los nombres de los métodos según la tabla de §2. Ya se actualizaron los scripts `db-check` y `db-seed-dev`.
- **Features nuevas:** se crean con esta forma (CONTEXTO §4, "Cómo agregar una feature nueva").
